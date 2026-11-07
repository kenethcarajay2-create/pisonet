
import { useState } from 'react';
import { Link } from 'react-router-dom';
import VoucherGenerator from '../components/vouchers/VoucherGenerator.jsx';

export default function Dashboard() {
  const [count, setCount] = useState(0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          Dashboard
        </h1>

        <p className="text-slate-400 mt-1">
          Manage your PisoNet Cloud computers and vouchers.
        </p>
      </div>

      <VoucherGenerator
        onCreated={() => setCount(c => c + 1)}
      />

      <div className="panel">
        <p className="font-semibold">Voucher history</p>

        <p className="text-slate-400 text-sm my-2">
          {count > 0
            ? `${count} voucher(s) generated in this visit.`
            : 'View your saved vouchers and redemption status.'}
        </p>

        <Link
          to="/vouchers"
          className="text-sky-400 text-sm"
        >
          View vouchers →
        </Link>
      </div>

      <div className="panel">
        <p className="font-semibold">
          PisoNet Computers
        </p>

        <p className="text-slate-400 text-sm my-2">
          Register new computers, generate device tokens,
          and monitor computer sessions.
        </p>

        <Link
          to="/computers"
          className="text-sky-400 text-sm"
        >
          Manage computers →
        </Link>
      </div>
    </div>
  );
}
