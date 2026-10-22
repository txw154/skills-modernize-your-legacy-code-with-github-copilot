# COBOL Account Management

This directory contains documentation for the COBOL account-management example in `src/cobol/`. The program operates on one generic account balance; it does not currently model student records or student-specific account types.

## Source Files

- [`main.cob`](../src/cobol/main.cob) — The `MainProgram` entry point displays the account menu, accepts a choice, and dispatches view, credit, and debit requests to `Operations`. Choosing 4 exits the program; other unrecognized choices display an error message.
- [`operations.cob`](../src/cobol/operations.cob) — The `Operations` program implements the account actions. It dispatches on the passed operation value: `TOTAL` reads and displays the balance, `CREDIT` accepts an amount and adds it, and `DEBIT` accepts an amount and subtracts it when funds are sufficient. It calls `DataProgram` to read or save the balance.
- [`data.cob`](../src/cobol/data.cob) — The `DataProgram` module provides `READ` and `WRITE` operations for the balance. Its working-storage balance is initialized to `1000.00`; the value is held in program memory rather than stored in a file or database.

## Business Rules

- The account starts with a balance of `1000.00`.
- A credit adds the entered amount to the balance.
- A debit is applied only when the current balance is greater than or equal to the entered amount. Otherwise, the program displays an insufficient-funds message and leaves the balance unchanged.
- The code defines no maximum balance, fees, student eligibility checks, student identifiers, or separate balances per student.
- No student-specific business rules are implemented in these files; the current rules apply to one generic account.

## Sequence Diagram

```mermaid
sequenceDiagram
actor User
participant Main as MainProgram
participant Ops as Operations
participant Data as DataProgram

loop Until the user selects Exit
Main->>User: Display menu
User->>Main: Enter menu choice
alt View balance
Main->>Ops: TOTAL
Ops->>Data: READ balance
Data-->>Ops: Current balance
Ops-->>User: Display current balance
else Credit account
Main->>Ops: CREDIT
Ops->>User: Prompt for credit amount
User->>Ops: Enter amount
Ops->>Data: READ balance
Data-->>Ops: Current balance
Ops->>Ops: Add amount to balance
Ops->>Data: WRITE updated balance
Data-->>Ops: Return
Ops-->>User: Display updated balance
else Debit account
Main->>Ops: DEBIT
Ops->>User: Prompt for debit amount
User->>Ops: Enter amount
Ops->>Data: READ balance
Data-->>Ops: Current balance
alt Balance covers debit
Ops->>Ops: Subtract amount from balance
Ops->>Data: WRITE updated balance
Data-->>Ops: Return
Ops-->>User: Display updated balance
else Insufficient funds
Ops-->>User: Display insufficient-funds message
end
else Exit
Main->>Main: Stop menu loop
else Invalid choice
Main-->>User: Display invalid-choice message
end
end
Main-->>User: Display goodbye message
```
