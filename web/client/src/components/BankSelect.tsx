import { useEffect, useState } from "react";
import { api } from "../api";
import type { BankAccount } from "../types";
import SearchableSelect from "./SearchableSelect";

/**
 * Bank picker for BANK/CHEQUE settlements. Renders nothing until a bank account
 * exists (all bank accounts share the one chart account, so the choice is
 * recorded on the document for reconciliation).
 */
export default function BankSelect({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}) {
  const [banks, setBanks] = useState<BankAccount[]>([]);

  useEffect(() => {
    api
      .bankAccounts()
      .then((list) => {
        setBanks(list);
        // Default to the first bank so a transaction is never left unassigned.
        if (value === 0 && list[0]) onChange(list[0].id);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (banks.length === 0) return null;
  return (
    <div>
      <label>Bank</label>
      <SearchableSelect
        value={value ? String(value) : ""}
        onChange={(next) => onChange(Number(next))}
        placeholder="Select bank..."
        emptyText="No matching bank"
        options={banks.map((bank) => ({
          value: String(bank.id),
          label: `${bank.bank_name} — ${bank.account_number}`,
        }))}
      />
    </div>
  );
}
