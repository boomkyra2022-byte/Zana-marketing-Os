import { signIn, signUp } from './actions';

export default function LoginPage({
  searchParams
}: {
  searchParams: { error?: string; message?: string };
}) {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-navy">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-2xl font-bold mb-1">ZANA Marketing OS V2</h1>
        <p className="text-sm text-gray-500 mb-6">Creative Generator → Video Analyzer → Creative Score</p>

        {searchParams.error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
            {searchParams.error}
          </div>
        )}
        {searchParams.message && (
          <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
            {searchParams.message}
          </div>
        )}

        <form action={signIn} className="space-y-4">
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn-primary w-full">
            เข้าสู่ระบบ
          </button>
        </form>

        <details className="mt-6">
          <summary className="cursor-pointer text-sm text-gray-500">สร้างบัญชีใหม่</summary>
          <form action={signUp} className="space-y-4 mt-4">
            <div>
              <label className="field-label" htmlFor="full_name">ชื่อ-นามสกุล</label>
              <input id="full_name" name="full_name" type="text" required />
            </div>
            <div>
              <label className="field-label" htmlFor="signup_email">Email</label>
              <input id="signup_email" name="email" type="email" required autoComplete="email" />
            </div>
            <div>
              <label className="field-label" htmlFor="signup_password">Password</label>
              <input id="signup_password" name="password" type="password" required minLength={6} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn-secondary w-full">
              สมัครสมาชิก
            </button>
          </form>
        </details>
      </div>
    </main>
  );
}
