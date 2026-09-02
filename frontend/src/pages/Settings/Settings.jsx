import { useState } from "react";
import { deleteAccount } from "../../services/authService";
import { useAuthContext } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../utils/constants";
import ThemeToggle from "../../components/common/ThemeToggle/ThemeToggle";


const DeleteAccountModal = ({ userEmail, onClose, onConfirmed }) => {
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState(null);

    const handleDelete = async () => {
        setDeleting(true);
        setError(null);
        try {
            await deleteAccount(userEmail);
            onConfirmed();
        } catch (err){
            setError(err.message || 'Account deletion failed');
            setDeleting(false);
        }
    };
    return (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{background: 'rgba(0,0,0,0.6)', zIndex: 10000}} onClick={deleting ? undefined : onClose} role="presentation">
            <div className="rounded-xl w-full max-w-md" style={{ background: 'var(--bg-primary,#0a0a0a)', border: '1px solid rgba(239,68,68,0.6)' }} onClick={(e) => e.stopPropagation()}>
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-subtle,#2a2a2a)'}}>
                    <h2 className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--signal-negative,#ef4444)'}}>
                        Delete Account
                    </h2>
                </div>
                <div className="px-5 py-4 flex flex-col gap-4">
                    {!confirming ? (
                        <>
                        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary,#a0a0a0)'}}>
                            This will permanently delete:
                        </p>
                        <ul className="text-[11px] leading-relaxed flex flex-col gap-1" style={{ color: 'var(--text-secondary,#a0a0a0)'}}>
                            <li>• Your account and login credentials</li>
                            <li>• All imported portfolios and holdings</li>
                            <li>• All transaction, dividend, and cost history</li>
                            <li>• All portfolio snapshots</li>
                            <li>• Your watchlist</li>
                            <li>• Your AI chat conversation and messages</li>
                        </ul>
                        <p className="text-[11px] font-medium" style={{ color: 'var(--signal-negative,#ef4444)'}}>
                            This cannot be undone.
                        </p>
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={onClose} className="text-[10px] font-mono px-3.5 py-2 rounded cursor-pointer"
                            style={{ color: 'var(--text-ghost,#444)', border: '1px solid var(--border-subtle,#2a2a2a)' }}>
                            Cancel
                            </button>
                            <button onClick={() => setConfirming(true)} className="text-[10px] font-mono px-3.5 py-2 rounded cursor-pointer"
                                style={{ background: 'var(--signal-negative,#ef4444)', color: '#fff' }}>
                                Continue
                            </button>
                        </div>
                        </>
                    ) : (
                    <>
                        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary,#a0a0a0)' }}>
                            Are you absolutely sure? This is your final confirmation for <span style={{ color: 'var(--text-primary,#e5e5e5)' }}>{userEmail}</span>.
                        </p>
                        {error && (
                            <p className="text-[11px]" style={{ color: 'var(--signal-negative,#ef4444)' }}>
                            {error}
                            </p>
                        )}
                        <div className="flex items-center justify-end gap-2 pt-1">
                            <button onClick={onClose} disabled={deleting} className="text-[10px] font-mono px-3.5 py-2 rounded cursor-pointer"
                                style={{ color: 'var(--text-ghost,#444)', border: '1px solid var(--border-subtle,#2a2a2a)' }}>
                                Cancel
                            </button>
                            <button onClick={handleDelete} disabled={deleting} className="text-[10px] font-mono px-3.5 py-2 rounded"
                                style={{
                                    background: 'var(--signal-negative,#ef4444)',
                                    color: '#fff',
                                    cursor: deleting ? 'not-allowed' : 'pointer',
                                    opacity: deleting ? 0.6 : 1,
                                }}>
                                {deleting ? 'Deleting...' : 'Permanently Delete'}
                            </button>
                        </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default function Settings(){
    const {user, logout} = useAuthContext();
    const navigate = useNavigate();
    const [typedEmail, setTypedEmail] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);

    const userEmail = user?.email || '';
    const emailMatches = typedEmail.trim().toLowerCase() === userEmail.trim().toLowerCase() && userEmail.length > 0;

    const handleDeleted = async () => {
        await logout();
        navigate(ROUTES.HOME);
    };

    return (
    <div className="p-4 flex flex-col gap-4 max-w-[800px] mx-auto w-full" aria-label="Settings page">
      <div className="flex items-center justify-between pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <h1 className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-page,#e5e5e5)' }}>
          Settings
        </h1>
      </div>

      <div className="glass-surface rounded-xl p-5">
        <p className="text-[9px] uppercase tracking-widest font-medium mb-2" style={{ color: 'var(--text-ghost,#444)'}}>
            Appearance
        </p>
        <div className="flex items-center gap-3">
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary,#a0a0a0)'}}>
                Switch between light and dark mode.
            </p>
            <ThemeToggle />
        </div>
      </div>

      <div className="glass-surface rounded-xl p-5">
        <p className="text-[9px] uppercase tracking-widest font-medium mb-2" style={{ color: 'var(--signal-negative,#ef4444)' }}>
          Danger Zone
        </p>
        <p className="text-[11px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary,#a0a0a0)' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>

        <label className="text-[9px] uppercase tracking-widest font-medium mb-2 block" style={{ color: 'var(--text-ghost,#444)' }}>
          Type your email ({userEmail}) to enable deletion
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            value={typedEmail}
            onChange={(e) => setTypedEmail(e.target.value)}
            placeholder={userEmail}
            className="flex-1 text-[11px] font-mono px-3 py-2 rounded"
            style={{ background: 'transparent', border: '1px solid var(--border-subtle,#2a2a2a)', color: 'var(--text-primary,#e5e5e5)' }}
          />
          <button
            onClick={() => setShowConfirm(true)}
            disabled={!emailMatches}
            className="text-[10px] font-mono px-3.5 py-2 rounded"
            style={{
              background: emailMatches ? 'var(--signal-negative,#ef4444)' : 'var(--border-subtle,#2a2a2a)',
              color: emailMatches ? '#fff' : 'var(--text-ghost,#444)',
              cursor: emailMatches ? 'pointer' : 'not-allowed',
            }}>
            Delete Account
          </button>
        </div>
      </div>

      {showConfirm && (
        <DeleteAccountModal
          userEmail={userEmail}
          onClose={() => setShowConfirm(false)}
          onConfirmed={handleDeleted}
        />
      )}
    </div>
  );
}

