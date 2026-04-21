import { useEffect, useState } from 'react';

const UnlicensedScreen = () => {
    const [step, setStep] = useState(1);
    const [hwid, setHwid] = useState('0000_0000_0000_0000');
    const [schoolName, setSchoolName] = useState('');
    const [licenseId, setLicenseId] = useState('');
    const [quickCode, setQuickCode] = useState('');
    const [isActivating, setIsActivating] = useState(false);
    const [error, setError] = useState('');



    useEffect(() => {
        const fetchHwid = async () => {
            try {
                const id = await (window as any).electronAPI.getHardwareID();
                if (id) setHwid(id);
            } catch (e) {
                console.error("Failed to fetch HWID:", e);
            }
        };
        fetchHwid();
    }, []);

    const handleCopy = () => {
        navigator.clipboard.writeText(hwid);
        setStep(2);
    };

    const handleActivate = async () => {
        if (!licenseId.trim() || !schoolName.trim()) {
            setError('School Identifier and License ID are required.');
            return;
        }
        
        setIsActivating(true);
        setError('');

        try {
            // Proceed with Activation - Backend will automatically handle signature for Siddesh school
            const result = await (window as any).electronAPI.saveLicense({
                license_id: licenseId.trim(),
                machine_name: schoolName.trim()
            });

            if (result.success) {
                await new Promise(r => setTimeout(r, 1500)); // Smooth transition delay
                const status = await (window as any).electronAPI.getLicenseStatus();
                if (status.valid) {
                    setStep(3);
                } else {
                    setError(`Verification Failed: ${status.reason || 'Invalid Identifier/ID'}`);
                }
            } else {
                setError(`System Error: ${result.error}`);
            }
        } catch (err: any) {
            setError(`Security Interface Error: ${err.message}`);
        } finally {
            setIsActivating(false);
        }
    };


    const styles: Record<string, React.CSSProperties> = {
        container: {
            height: '100vh',
            width: '100vw',
            background: 'radial-gradient(circle at top right, #1c1c3e 0%, #0a0a14 100%)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: '#fff',
            fontFamily: '"Outfit", "Inter", sans-serif',
            overflow: 'hidden',
            position: 'relative'
        },
        mesh: {
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'100\' height=\'100\' viewBox=\'0 0 100 100\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 86c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm66 3c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zm-46-45c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm26 18c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm16-18c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-32 30c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-18-60c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm60 4c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-6 40c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1zm-12-64c.552 0 1-.448 1-1s-.448-1-1-1-1 .448-1 1 .448 1 1 1z\' fill=\'%23ffffff\' fill-opacity=\'0.03\' fill-rule=\'evenodd\'/%3E%3C/svg%3E")',
            opacity: 0.5
        },
        card: {
            background: 'rgba(22, 22, 37, 0.7)',
            backdropFilter: 'blur(20px)',
            borderRadius: '40px',
            padding: '3rem',
            width: '100%',
            maxWidth: '520px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 50px 100px -20px rgba(0, 0, 0, 0.7)',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem',
            position: 'relative',
            zIndex: 10,
            animation: 'fadeIn 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
        },
        inputWrapper: {
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.8rem'
        },
        label: {
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#00d2ff',
            letterSpacing: '0.1em',
            marginLeft: '5px'
        },

        input: {
            width: '100%',
            padding: '1.1rem',
            borderRadius: '16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#fff',
            fontSize: '0.95rem',
            outline: 'none',
            transition: 'all 0.3s ease'
        },
        primaryBtn: {
            padding: '1.2rem',
            borderRadius: '18px',
            border: 'none',
            background: 'linear-gradient(135deg, #00d2ff 0%, #3a7bd5 100%)',
            color: '#000',
            fontWeight: 800,
            fontSize: '1rem',
            cursor: 'pointer',
            boxShadow: '0 10px 20px -5px rgba(0, 210, 255, 0.4)',
            transition: 'all 0.2s ease'
        },
        secondaryBtn: {
            padding: '1rem',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(255, 255, 255, 0.02)',
            color: '#888',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.mesh} />
            
            <div style={styles.card}>
                {/* Branding Icon */}
                <div style={{ marginBottom: '0.5rem' }}>
                    <div style={{ 
                        width: '70px', height: '70px', 
                        margin: '0 auto', 
                        background: 'rgba(0, 210, 255, 0.1)', 
                        borderRadius: '22px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '2.5rem',
                        boxShadow: 'inset 0 0 20px rgba(0, 210, 255, 0.1)'
                    }}>
                        {step === 3 ? '🎉' : '🏢'}
                    </div>
                </div>

                {step === 1 && (
                    <>
                        <div>
                            <h1 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0 }}>School Deployment</h1>
                            <p style={{ color: '#888', marginTop: '0.6rem', fontSize: '1rem' }}>Siddesh Global Education Society</p>
                        </div>

                        <div style={{ 
                            background: 'rgba(0,0,0,0.2)', 
                            padding: '1.5rem', 
                            borderRadius: '20px', 
                            border: '1px solid rgba(255,255,255,0.05)',
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: '0.8rem',
                            color: '#00d2ff',
                            wordBreak: 'break-all'
                        }}>
                            {hwid}
                        </div>

                        <button 
                            style={styles.primaryBtn} 
                            onClick={handleCopy}
                            onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                            onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            Begin Activation
                        </button>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div style={{ textAlign: 'left' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Secure Activation</h2>
                            <p style={{ color: '#666', marginTop: '0.4rem', fontSize: '0.9rem' }}>Enter the deployment credentials below.</p>
                        </div>

                        <div style={styles.inputWrapper}>
                            <span style={styles.label}>SCHOOL IDENTIFIER</span>
                            <input 
                                style={styles.input} 
                                value={schoolName}
                                placeholder="Siddesh-Global-..."
                                onChange={(e) => setSchoolName(e.target.value)}
                            />

                            <span style={styles.label}>LICENSE ID</span>
                            <input 
                                style={styles.input} 
                                value={licenseId}
                                placeholder="LIC-XXXXXX"
                                onChange={(e) => setLicenseId(e.target.value)}
                            />
                        </div>



                        {error && <div style={{ color: '#ff4d4f', fontSize: '0.85rem', fontWeight: 600 }}>{error}</div>}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                            <button style={styles.secondaryBtn} onClick={() => setStep(1)}>Back</button>
                            <button 
                                style={{ ...styles.primaryBtn, filter: isActivating ? 'grayscale(0.5)' : 'none' }} 
                                onClick={handleActivate}
                                disabled={isActivating}
                            >
                                {isActivating ? 'Locking Hardware...' : 'Activate System'}
                            </button>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <div style={{ padding: '1rem 0' }}>
                            <h1 style={{ fontSize: '2.2rem', fontWeight: 900, color: '#00ffaa' }}>Session Bound</h1>
                            <p style={{ color: '#aaa', marginTop: '1rem', lineHeight: '1.6' }}>
                                This physical hardware is now uniquely bound to <b>{schoolName}</b>. 
                                The deployment package is now functional.
                            </p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button style={styles.primaryBtn} onClick={() => window.location.reload()}>
                                Restart Application
                            </button>
                            <button 
                                onClick={() => (window as any).electronAPI.exitApp()}
                                style={{ border: 'none', background: 'none', color: '#555', cursor: 'pointer', fontWeight: 600 }}
                            >
                                Close Wizard
                            </button>
                        </div>
                    </>
                )}

                <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#333', letterSpacing: '0.1em' }}>
                    SIDDESH GLOBAL SECURE DEPLOYMENT v1.0.2
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98) translateY(10px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>

        </div>
    );
};

export default UnlicensedScreen;
