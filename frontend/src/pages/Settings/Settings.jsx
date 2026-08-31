import { useState } from "react";
import { deleteAccount } from "../../services/authService";


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
            <div className="glass-surface-elevated rounded-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
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