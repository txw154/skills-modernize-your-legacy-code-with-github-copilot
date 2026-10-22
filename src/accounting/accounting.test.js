'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const {
  createDataStore,
  formatBalance,
  parseAmount,
  viewBalance,
  credit,
  debit,
} = require('./index.js');

const APP = path.join(__dirname, 'index.js');
const OPENING = '001000.00';

// Runs the application in a fresh process, feeding each line as user input.
function runSession(lines) {
  const result = spawnSync(process.execPath, [APP], {
    input: `${lines.join('\n')}\n`,
    encoding: 'utf8',
    timeout: 10000,
  });
  return { stdout: result.stdout, status: result.status };
}

const countOf = (text, needle) => text.split(needle).length - 1;

describe('helpers', () => {
  describe('formatBalance', () => {
    test('zero-pads to PIC 9(6)V99 display format', () => {
      expect(formatBalance(100000)).toBe('001000.00');
      expect(formatBalance(0)).toBe('000000.00');
      expect(formatBalance(20001)).toBe('000200.01');
    });
  });

  describe('parseAmount', () => {
    test.each([
      ['250', 25000],
      ['125.75', 12575],
      ['25.5', 2550],
      ['0', 0],
      ['999999.99', 99999999],
      [' 300 ', 30000],
    ])('accepts %p as %p cents', (text, cents) => {
      expect(parseAmount(text)).toBe(cents);
    });

    test.each(['abc', '', '1.234', '1000000', '-5', '1,000'])(
      'rejects %p',
      (text) => {
        expect(parseAmount(text)).toBeNull();
      },
    );
  });

  describe('viewBalance', () => {
    test('ACC-002: reading the balance does not change it', () => {
      const store = createDataStore();
      expect(viewBalance(store).message).toBe(`Current balance: ${OPENING}`);
      expect(viewBalance(store).message).toBe(`Current balance: ${OPENING}`);
      expect(store.read()).toBe(100000);
    });
  });
});

describe('ACC-001: opening balance', () => {
  test('a fresh session starts at 001000.00', () => {
    const { stdout } = runSession(['1', '4']);
    expect(stdout).toContain(`Current balance: ${OPENING}`);
  });
});

describe('ACC-002: viewing balance does not modify it', () => {
  test('two views in one session both show 001000.00', () => {
    const { stdout } = runSession(['1', '1', '4']);
    expect(countOf(stdout, `Current balance: ${OPENING}`)).toBe(2);
  });
});

describe('ACC-003: credit a whole-number amount', () => {
  test('credit confirmation and balance show 001250.00', () => {
    const { stdout } = runSession(['2', '250', '1', '4']);
    expect(stdout).toContain('Enter credit amount: ');
    expect(stdout).toContain('Amount credited. New balance: 001250.00');
    expect(stdout).toContain('Current balance: 001250.00');
  });
});

describe('ACC-004: credit an amount containing cents', () => {
  test('balance shows 001125.75', () => {
    const { stdout } = runSession(['2', '125.75', '1', '4']);
    expect(stdout).toContain('Amount credited. New balance: 001125.75');
    expect(stdout).toContain('Current balance: 001125.75');
  });
});

describe('ACC-005: credit zero (current behavior, pending business confirmation)', () => {
  test('zero credit is reported as credited and leaves the balance unchanged', () => {
    const { stdout } = runSession(['2', '0', '1', '4']);
    expect(stdout).toContain(`Amount credited. New balance: ${OPENING}`);
    expect(stdout).toContain(`Current balance: ${OPENING}`);
  });
});

describe('ACC-006: multiple credits in one session', () => {
  test('balance is 001125.50', () => {
    const { stdout } = runSession(['2', '100', '2', '25.50', '1', '4']);
    expect(stdout).toContain('Current balance: 001125.50');
  });
});

describe('ACC-007: debit less than the balance', () => {
  test('debit confirmation and balance show 000700.00', () => {
    const { stdout } = runSession(['3', '300', '1', '4']);
    expect(stdout).toContain('Enter debit amount: ');
    expect(stdout).toContain('Amount debited. New balance: 000700.00');
    expect(stdout).toContain('Current balance: 000700.00');
  });
});

describe('ACC-008: debit the exact balance (equality boundary)', () => {
  test('debit is accepted and the balance becomes 000000.00', () => {
    const { stdout } = runSession(['3', '1000', '1', '4']);
    expect(stdout).toContain('Amount debited. New balance: 000000.00');
    expect(stdout).toContain('Current balance: 000000.00');
    expect(stdout).not.toContain('Insufficient funds');
  });
});

describe('ACC-009: debit an amount containing cents', () => {
  test('balance shows 000874.25', () => {
    const { stdout } = runSession(['3', '125.75', '1', '4']);
    expect(stdout).toContain('Amount debited. New balance: 000874.25');
    expect(stdout).toContain('Current balance: 000874.25');
  });
});

describe('ACC-010: debit zero (current behavior, pending business confirmation)', () => {
  test('zero debit is reported as debited and leaves the balance unchanged', () => {
    const { stdout } = runSession(['3', '0', '1', '4']);
    expect(stdout).toContain(`Amount debited. New balance: ${OPENING}`);
    expect(stdout).toContain(`Current balance: ${OPENING}`);
  });
});

describe('ACC-011: reject debit greater than the balance', () => {
  test('shows insufficient funds, no debit confirmation, balance unchanged', () => {
    const { stdout } = runSession(['3', '1000.01', '1', '4']);
    expect(stdout).toContain('Insufficient funds for this debit.');
    expect(stdout).not.toContain('Amount debited');
    expect(stdout).toContain(`Current balance: ${OPENING}`);
  });
});

describe('ACC-012: reject debit after the balance has been reduced', () => {
  test('second debit is rejected against the latest balance of 000200.00', () => {
    const { stdout } = runSession(['3', '800', '3', '200.01', '1', '4']);
    expect(stdout).toContain('Amount debited. New balance: 000200.00');
    expect(countOf(stdout, 'Insufficient funds for this debit.')).toBe(1);
    expect(stdout).toContain('Current balance: 000200.00');
  });
});

describe('ACC-013: balance preserved across operations in one session', () => {
  test('view 001250.25, then debit 100.10 leaves 001150.15', () => {
    const { stdout } = runSession(['2', '250.25', '1', '3', '100.10', '1', '4']);
    expect(stdout).toContain('Current balance: 001250.25');
    expect(stdout).toContain('Amount debited. New balance: 001150.15');
    expect(stdout).toContain('Current balance: 001150.15');
  });
});

describe('ACC-014: unrecognized menu choice', () => {
  test('each invalid choice shows the error and the menu continues', () => {
    const { stdout } = runSession(['0', '5', '4']);
    expect(countOf(stdout, 'Invalid choice, please select 1-4.')).toBe(2);
    // Menu is shown before the initial choice and again after each invalid one.
    expect(countOf(stdout, 'Account Management System')).toBe(3);
    expect(stdout).toContain('Exiting the program. Goodbye!');
  });
});

describe('ACC-015: exit the application', () => {
  test('selecting 4 ends the loop with a goodbye message and exit code 0', () => {
    const { stdout, status } = runSession(['4']);
    expect(stdout).toContain('Exiting the program. Goodbye!');
    expect(status).toBe(0);
    expect(countOf(stdout, 'Account Management System')).toBe(1);
  });
});

describe('ACC-016: restart starts a new in-memory account', () => {
  test('a new process does not see the credit from a prior process', () => {
    const first = runSession(['2', '50', '4']);
    expect(first.stdout).toContain('Amount credited. New balance: 001050.00');

    const second = runSession(['1', '4']);
    expect(second.stdout).toContain(`Current balance: ${OPENING}`);
    expect(second.stdout).not.toContain('001050.00');
  });
});

describe('ACC-017: numeric amount limit (characterization, business decision required)', () => {
  test('credit to 999999.99 is rejected by the current code and balance is unchanged', () => {
    const { stdout } = runSession(['2', '999999.99', '1', '4']);
    expect(stdout).toContain('Credit rejected. Balance cannot exceed 999999.99.');
    expect(stdout).not.toContain('Amount credited');
    expect(stdout).toContain(`Current balance: ${OPENING}`);
  });

  test('credit that lands exactly on the 999999.99 cap is accepted', () => {
    const store = createDataStore();
    const result = credit(store, 99899999); // 998999.99 on top of 1000.00 hits 999999.99 exactly
    expect(result.ok).toBe(true);
    expect(store.read()).toBe(99999999);
  });

  test('credit one cent past the cap is rejected and the store is not written', () => {
    const store = createDataStore();
    const result = credit(store, 99999900);
    expect(result.ok).toBe(false);
    expect(store.read()).toBe(100000);
  });
});

describe('ACC-018: malformed or unsupported amount input (characterization)', () => {
  test.each([
    ['non-numeric text at credit prompt', ['2', 'abc', '1', '4'], 'credit'],
    ['more than two decimals at credit prompt', ['2', '1.234', '1', '4'], 'credit'],
    ['non-numeric text at debit prompt', ['3', 'abc', '1', '4'], 'debit'],
    ['more than two decimals at debit prompt', ['3', '1.234', '1', '4'], 'debit'],
  ])('%s is rejected with a message and the balance is unchanged', (_label, input) => {
    const { stdout, status } = runSession(input);
    expect(stdout).toContain(
      'Invalid amount. Enter up to 6 digits with up to 2 decimal places.',
    );
    expect(stdout).not.toMatch(/Amount (credited|debited)/);
    expect(stdout).toContain(`Current balance: ${OPENING}`);
    expect(status).toBe(0);
  });
});
