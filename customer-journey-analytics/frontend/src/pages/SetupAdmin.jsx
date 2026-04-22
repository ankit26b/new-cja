import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Login.css';

function SetupAdmin() {
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('http://localhost:5000/api/auth/setup-admin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password
                })
            });

            const data = await res.json();

            if (res.ok) {
                navigate('/login', {
                    state: {
                        message: 'Admin account created successfully. Please log in.'
                    }
                });
                return;
            }

            if (res.status === 403) {
                setError('An admin account already exists. Please log in.');
                return;
            }

            setError(data.error || 'Admin setup failed');
        } catch (err) {
            setError('Unable to connect to the server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>First-Time Admin Setup</h2>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <button type="submit" disabled={loading}>
                        {loading ? 'Creating admin...' : 'Create Admin'}
                    </button>
                </form>

                <p className="register-link">
                    Already set up? <Link to="/login">Log in</Link>
                </p>

                <p className="back-link">
                    <Link to="/">← Back to Store</Link>
                </p>
            </div>
        </div>
    );
}

export default SetupAdmin;
