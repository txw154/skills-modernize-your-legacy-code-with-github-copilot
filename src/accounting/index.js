#!/usr/bin/env node
'use strict';

const readline = require('node:readline');

// Money is held as integer cents so additions and subtractions are exact.
const INITIAL_BALANCE_CENTS = 100000; // 1000.00
// Largest value the COBOL PIC 9(6)V99 balance field can hold: 999999.99.
const MAX_BALANCE_CENTS = 99999999;

// Mirrors DataProgram: the balance lives in memory only and is not persisted.
function createDataStore(initialCents = INITIAL_BALANCE_CENTS) {
  let balanceCents = initialCents;
  return {
    read: () => balanceCents,
    write: (cents) => {
      balanceCents = cents;
    },
  };
}

// Formats like PIC 9(6)V99 display, e.g. 1000.00 -> "001000.00".
function formatBalance(cents) {
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return `${String(whole).padStart(6, '0')}.${String(fraction).padStart(2, '0')}`;
}

// Accepts up to 6 whole digits and up to 2 decimal places, matching PIC 9(6)V99.
// Returns integer cents, or null when the input is not a valid amount.
function parseAmount(text) {
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) {
    return null;
  }
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(2, '0'));
  return whole * 100 + fraction;
}

// Mirrors Operations TOTAL: reads and reports the balance.
function viewBalance(store) {
  return { ok: true, message: `Current balance: ${formatBalance(store.read())}` };
}

// Mirrors Operations CREDIT: adds the amount to the balance.
function credit(store, amountCents) {
  const newBalance = store.read() + amountCents;
  if (newBalance > MAX_BALANCE_CENTS) {
    return {
      ok: false,
      message: `Credit rejected. Balance cannot exceed ${formatBalance(MAX_BALANCE_CENTS)}.`,
    };
  }
  store.write(newBalance);
  return { ok: true, message: `Amount credited. New balance: ${formatBalance(newBalance)}` };
}

// Mirrors Operations DEBIT: only applied when the balance covers the amount.
function debit(store, amountCents) {
  const current = store.read();
  if (current < amountCents) {
    return { ok: false, message: 'Insufficient funds for this debit.' };
  }
  const newBalance = current - amountCents;
  store.write(newBalance);
  return { ok: true, message: `Amount debited. New balance: ${formatBalance(newBalance)}` };
}

const MENU_LINES = [
  '--------------------------------',
  'Account Management System',
  '1. View Balance',
  '2. Credit Account',
  '3. Debit Account',
  '4. Exit',
  '--------------------------------',
];

async function main() {
  const store = createDataStore();
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  const lines = rl[Symbol.asyncIterator]();

  // Returns the next input line, or null when input ends.
  const prompt = async (text) => {
    process.stdout.write(text);
    const next = await lines.next();
    return next.done ? null : next.value;
  };

  const askAmount = async (text) => {
    const raw = await prompt(text);
    if (raw === null) {
      return { eof: true };
    }
    const cents = parseAmount(raw);
    if (cents === null) {
      console.log('Invalid amount. Enter up to 6 digits with up to 2 decimal places.');
    }
    return { eof: false, cents };
  };

  let running = true;
  while (running) {
    for (const line of MENU_LINES) {
      console.log(line);
    }
    const choice = await prompt('Enter your choice (1-4): ');
    if (choice === null) {
      break;
    }
    switch (choice.trim()) {
      case '1':
        console.log(viewBalance(store).message);
        break;
      case '2': {
        const amount = await askAmount('Enter credit amount: ');
        if (amount.eof) {
          running = false;
        } else if (amount.cents !== undefined && amount.cents !== null) {
          console.log(credit(store, amount.cents).message);
        }
        break;
      }
      case '3': {
        const amount = await askAmount('Enter debit amount: ');
        if (amount.eof) {
          running = false;
        } else if (amount.cents !== undefined && amount.cents !== null) {
          console.log(debit(store, amount.cents).message);
        }
        break;
      }
      case '4':
        running = false;
        break;
      default:
        console.log('Invalid choice, please select 1-4.');
    }
  }

  console.log('Exiting the program. Goodbye!');
  rl.close();
}

if (require.main === module) {
  main();
}

module.exports = { createDataStore, formatBalance, parseAmount, viewBalance, credit, debit };
