import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { auth, db } from './firebase';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword
} from 'firebase/auth';
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore';

const inputStyle = {
  boxSizing: 'border-box',
  width: '100%'
};

const fieldStyle = { display: 'grid', gap: '0.35rem', marginBottom: '1rem' };
const panelStyle = {
  background: 'var(--panel-bg)',
  padding: '1.5rem',
  borderRadius: '12px',
  border: '1px solid var(--border)',
  marginBottom: '1.5rem',
  boxShadow: 'var(--panel-shadow)'
};

const applicationFields = {
  borrower: '',
  applicantEmail: '',
  phone: '',
  location: '',
  loanRequested: ''
};

const getApplicationDate = (timestamp) => {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp ? new Date(timestamp) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : '';
};

const getErrorMessage = (error) => error instanceof Error ? error.message : 'An unexpected error occurred.';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [pipeline, setPipeline] = useState([]);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [applicationForm, setApplicationForm] = useState(applicationFields);
  const [pipelineError, setPipelineError] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [applicationSuccess, setApplicationSuccess] = useState('');
  const [applicationBusy, setApplicationBusy] = useState(false);
  const applicationSubmitting = useRef(false);
  const [page, setPage] = useState('pipeline');
  const [searchFields, setSearchFields] = useState({
    borrower: '',
    applicantEmail: '',
    phone: '',
    location: '',
    minimumAmount: '',
    maximumAmount: '',
    fromDate: '',
    toDate: ''
  });
  const [submittedSearch, setSubmittedSearch] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [editingApplication, setEditingApplication] = useState(false);
  const [deletingApplication, setDeletingApplication] = useState(false);
  const [applicationActionSuccess, setApplicationActionSuccess] = useState('');
  const [editForm, setEditForm] = useState(applicationFields);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  );
  const [themeOverride, setThemeOverride] = useState(null);
  const theme = themeOverride || (systemPrefersDark ? 'dark' : 'light');

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const updateSystemPreference = (event) => setSystemPrefersDark(event.matches);
    colorScheme.addEventListener('change', updateSystemPreference);
    return () => colorScheme.removeEventListener('change', updateSystemPreference);
  }, []);

  useEffect(() => onAuthStateChanged(auth, (currentUser) => {
    setUser(currentUser);
    setPipelineLoading(Boolean(currentUser));
    setAuthLoading(false);
  }, (error) => {
    setAuthError(error.message);
    setAuthLoading(false);
  }), []);

  useEffect(() => {
    if (!user) {
      setPipeline([]);
      setPipelineLoading(false);
      return;
    }

    setPipelineLoading(true);
    setPipelineError('');

    const unsubscribe = onSnapshot(collection(db, "applications"), (querySnapshot) => {
      const apps = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPipeline(apps);
      setPipelineLoading(false);
      setPipelineError('');
    }, (error) => {
      console.error("Error reading from Firebase:", error);
      setPipelineError(error.message);
      setPipelineLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthBusy(true);
    try {
      if (authMode === 'register') {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setPassword('');
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    setAuthError('');
    try {
      await signOut(auth);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleAddApplication = async (e) => {
    e.preventDefault();
    if (applicationSubmitting.current) return;

    applicationSubmitting.current = true;
    setApplicationBusy(true);
    setApplicationError('');
    setApplicationSuccess('');
    try {
      const application = {
        borrower: applicationForm.borrower.trim(),
        applicantEmail: applicationForm.applicantEmail.trim(),
        phone: applicationForm.phone.trim(),
        location: applicationForm.location.trim(),
        loanRequested: applicationForm.loanRequested,
        status: "Applied",
        timestamp: serverTimestamp(),
        createdBy: user.uid
      };
      await addDoc(collection(db, "applications"), application);
      setApplicationForm(applicationFields);
      setApplicationSuccess('Application submitted successfully.');
    } catch (error) {
      console.error("Error writing to Firebase:", error);
      setApplicationError(
        error.code === 'permission-denied'
          ? 'Firebase denied this write. Check that you are signed in and that your Firestore security rules allow signed-in users to add applications.'
          : `Could not submit application: ${error.message}`
      );
    } finally {
      applicationSubmitting.current = false;
      setApplicationBusy(false);
    }
  };

  const openApplication = (application) => {
    setSelectedApplication(application);
    setEditingApplication(false);
    setEditError('');
    setEditSuccess('');
    setApplicationActionSuccess('');
  };

  const startEditingApplication = () => {
    setEditForm({
      borrower: selectedApplication.borrower || '',
      applicantEmail: selectedApplication.applicantEmail || '',
      phone: selectedApplication.phone || '',
      location: selectedApplication.location || '',
      loanRequested: selectedApplication.loanRequested || ''
    });
    setEditError('');
    setEditSuccess('');
    setEditingApplication(true);
  };

  const handleEditApplication = async (e) => {
    e.preventDefault();
    setEditBusy(true);
    setEditError('');
    setEditSuccess('');
    const updatedFields = {
      borrower: editForm.borrower.trim(),
      applicantEmail: editForm.applicantEmail.trim(),
      phone: editForm.phone.trim(),
      location: editForm.location.trim(),
      loanRequested: editForm.loanRequested
    };

    try {
      await updateDoc(doc(db, 'applications', selectedApplication.id), updatedFields);
      setSelectedApplication(current => ({ ...current, ...updatedFields }));
      setEditingApplication(false);
      setEditSuccess('Application updated successfully.');
    } catch (error) {
      console.error('Error updating application in Firebase:', error);
      setEditError(
        error.code === 'permission-denied'
          ? 'Firebase denied this update. Update your Firestore rules to allow signed-in users to update applications.'
          : `Could not update application: ${getErrorMessage(error)}`
      );
    } finally {
      setEditBusy(false);
    }
  };

  const handleDeleteApplication = async () => {
    if (!selectedApplication || deletingApplication) return;

    const confirmed = window.confirm(
      `Delete the application for ${selectedApplication.borrower || 'this borrower'}? This cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingApplication(true);
    setEditError('');
    setApplicationActionSuccess('');
    try {
      await deleteDoc(doc(db, 'applications', selectedApplication.id));
      setSelectedApplication(null);
      setEditingApplication(false);
      setApplicationActionSuccess('Application deleted successfully.');
    } catch (error) {
      console.error('Error deleting application from Firebase:', error);
      setEditError(
        error.code === 'permission-denied'
          ? 'Firebase denied this deletion. Update your Firestore rules to allow signed-in users to delete applications.'
          : `Could not delete application: ${getErrorMessage(error)}`
      );
    } finally {
      setDeletingApplication(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSubmittedSearch(searchFields);
    setSelectedApplication(null);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setProfileError('');
    setProfileSuccess('');

    if (!user?.email) {
      setProfileError('A signed-in email account is required to change the password.');
      return;
    }
    if (!user.providerData.some(provider => provider.providerId === 'password')) {
      setProfileError('This account does not use an email-and-password sign-in. Change its password through its identity provider.');
      return;
    }
    if (newPassword.length < 6) {
      setProfileError('The new password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setProfileError('The new passwords do not match.');
      return;
    }

    setProfileBusy(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setProfileSuccess('Password updated successfully.');
    } catch (error) {
      console.error('Error updating account password:', error);
      setProfileError(`Could not update password: ${getErrorMessage(error)}`);
    } finally {
      setProfileBusy(false);
    }
  };

  const filteredApplications = submittedSearch ? pipeline.filter(application => {
    const matchesText = (value, search) =>
      !search || String(value || '').toLowerCase().includes(search.trim().toLowerCase());
    const amount = Number(application.loanRequested);
    const date = getApplicationDate(application.timestamp);

    return matchesText(application.borrower, submittedSearch.borrower)
      && matchesText(application.applicantEmail, submittedSearch.applicantEmail)
      && matchesText(application.phone, submittedSearch.phone)
      && matchesText(application.location, submittedSearch.location)
      && (!submittedSearch.minimumAmount || amount >= Number(submittedSearch.minimumAmount))
      && (!submittedSearch.maximumAmount || amount <= Number(submittedSearch.maximumAmount))
      && (!submittedSearch.fromDate || (date && date >= submittedSearch.fromDate))
      && (!submittedSearch.toDate || (date && date <= submittedSearch.toDate));
  }) : [];

  return (
    <div
      className={!user ? 'auth-screen' : `app-screen theme-${theme}`}
    >
      {authLoading ? <p>Checking your sign-in status...</p> : null}

      {!authLoading && !user ? (
        <main className="auth-layout">
          <form onSubmit={handleAuthSubmit} className="auth-card">
            <section className="auth-intro">
              <img className="auth-logo" src="/favicon.png" alt="AL Agentic Lender" />
              <h1>{authMode === 'register' ? 'Create account' : 'Sign in'}</h1>
              <p>{authMode === 'register' ? 'Create an account to access the application pipeline.' : 'to continue to Agentic Lender'}</p>
            </section>
            <section className="auth-fields" aria-label={authMode === 'register' ? 'Register' : 'Sign in'}>
              <label className="auth-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  required
                />
              </label>
              <label className="auth-field">
                <span>Password</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={authMode === 'register' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={authMode === 'register' ? 'Create a password' : 'Enter your password'}
                  minLength={6}
                  required
                />
              </label>
              <label className="auth-show-password">
                <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                <span>Show password</span>
              </label>
              {authError ? <p role="alert" className="auth-error">{authError}</p> : null}
              <div className="auth-actions">
                <button
                  type="button"
                  className="auth-switch"
                  onClick={() => {
                    setAuthMode(authMode === 'register' ? 'login' : 'register');
                    setAuthError('');
                    setPassword('');
                  }}
                >
                  {authMode === 'register' ? 'Sign in instead' : 'Create account'}
                </button>
                <button type="submit" className="auth-submit" disabled={authBusy}>
                  {authBusy ? 'Please wait...' : authMode === 'register' ? 'Create account' : 'Sign in'}
                </button>
              </div>
            </section>
          </form>
          <footer className="auth-footer">
            <span>Secure sign-in powered by Firebase</span>
            <span>Agentic Lender</span>
          </footer>
        </main>
      ) : null}

      {user ? (
        <main className="app-content">
          <header className="app-header">
            <nav aria-label="Main navigation" className="app-navigation">
              {[
                ['pipeline', 'Pipeline'],
                ['search', 'Search'],
                ['profile', 'Profile']
              ].map(([pageId, label]) => (
                <a
                  key={pageId}
                  href={`#${pageId}`}
                  aria-current={page === pageId ? 'page' : undefined}
                  aria-label={label}
                  title={label}
                  onClick={() => {
                    setPage(pageId);
                    setSelectedApplication(null);
                  }}
                  className={`navigation-link${page === pageId ? ' is-active' : ''}`}
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 24 24"
                    className="navigation-icon"
                  >
                    {pageId === 'pipeline' ? (
                      <path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />
                    ) : null}
                    {pageId === 'search' ? (
                      <>
                        <circle cx="10.8" cy="10.8" r="6.8" />
                        <path d="m16 16 5 5" />
                      </>
                    ) : null}
                    {pageId === 'profile' ? (
                      <>
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
                      </>
                    ) : null}
                  </svg>
                  <span className="navigation-label">{label}</span>
                </a>
              ))}
            </nav>
            <button type="button" onClick={handleSignOut} className="sign-out-button">Sign out</button>
          </header>
          {authError ? <p role="alert" className="error-message">{authError}</p> : null}

          {page === 'pipeline' ? (
            <section>
              <form onSubmit={handleAddApplication} style={panelStyle} className="application-form">
                <h2>Submit Application</h2>
                <div className="form-grid">
                  <label style={fieldStyle}>Borrower Name
                    <input type="text" value={applicationForm.borrower} onChange={e => setApplicationForm({ ...applicationForm, borrower: e.target.value })} style={inputStyle} required />
                  </label>
                  <label style={fieldStyle}>Email
                    <input type="email" value={applicationForm.applicantEmail} onChange={e => setApplicationForm({ ...applicationForm, applicantEmail: e.target.value })} style={inputStyle} required />
                  </label>
                  <label style={fieldStyle}>Phone Number
                    <input type="tel" value={applicationForm.phone} onChange={e => setApplicationForm({ ...applicationForm, phone: e.target.value })} style={inputStyle} required />
                  </label>
                  <label style={fieldStyle}>Location
                    <input type="text" value={applicationForm.location} onChange={e => setApplicationForm({ ...applicationForm, location: e.target.value })} style={inputStyle} required />
                  </label>
                  <label style={fieldStyle} className="loan-field">Loan Requested (€)
                    <input className="loan-requested-input" type="number" min="1" value={applicationForm.loanRequested} onChange={e => setApplicationForm({ ...applicationForm, loanRequested: e.target.value })} style={inputStyle} required />
                  </label>
                </div>
                <button type="submit" disabled={applicationBusy} className="primary-button">
                  {applicationBusy ? 'Submitting...' : 'Submit'}
                </button>
                {applicationSuccess ? <p role="status" className="success-message">{applicationSuccess}</p> : null}
                {applicationError ? <p role="alert" className="error-message">{applicationError}</p> : null}
              </form>

              <h2 className="section-heading">Active Pipeline Volume</h2>
              {pipelineError ? <p role="alert" className="error-message">Could not load applications: {pipelineError}</p> : null}
              {applicationActionSuccess ? <p role="status" className="success-message">{applicationActionSuccess}</p> : null}
              {pipelineLoading ? <p className="muted-message">Loading applications...</p> : null}
              {!pipelineLoading && !pipelineError && pipeline.length === 0 ? <p className="muted-message">No applications found. Enter a test application above to verify connection...</p> : null}
              <ul className="application-list">
                {pipeline.map(app => (
                  <li key={app.id} className="application-card">
                    <button type="button" onClick={() => { openApplication(app); setPage('search'); }} className="application-card-link">
                      <strong>{app.borrower || 'Unnamed borrower'}</strong> — €{app.loanRequested}
                    </button>
                    <span className="application-status">{app.status || 'Applied'}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {page === 'search' ? (
            <section>
              <h2 className="page-heading">Search Applications</h2>
              <form onSubmit={handleSearch} style={panelStyle}>
                <div className="form-grid">
                  {[
                    ['borrower', 'Borrower Name'],
                    ['applicantEmail', 'Email'],
                    ['phone', 'Phone Number'],
                    ['location', 'Location']
                  ].map(([key, label]) => (
                    <label key={key} style={fieldStyle}>{label}
                      <input type="search" value={searchFields[key]} onChange={e => setSearchFields({ ...searchFields, [key]: e.target.value })} style={inputStyle} />
                    </label>
                  ))}
                  <label style={fieldStyle}>Minimum Amount (€)
                    <input type="number" min="0" value={searchFields.minimumAmount} onChange={e => setSearchFields({ ...searchFields, minimumAmount: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={fieldStyle}>Maximum Amount (€)
                    <input type="number" min="0" value={searchFields.maximumAmount} onChange={e => setSearchFields({ ...searchFields, maximumAmount: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={fieldStyle}>From Date
                    <input type="date" value={searchFields.fromDate} onChange={e => setSearchFields({ ...searchFields, fromDate: e.target.value })} style={inputStyle} />
                  </label>
                  <label style={fieldStyle}>To Date
                    <input type="date" value={searchFields.toDate} onChange={e => setSearchFields({ ...searchFields, toDate: e.target.value })} style={inputStyle} />
                  </label>
                </div>
                <button type="submit" className="primary-button">Search</button>
              </form>
              {pipelineError ? <p role="alert" className="error-message">Could not load applications: {pipelineError}</p> : null}
              {pipelineLoading ? <p className="muted-message">Loading applications...</p> : null}
              {!pipelineLoading && submittedSearch && !selectedApplication ? (
                <>
                  <h2 className="section-heading">Results ({filteredApplications.length})</h2>
                  {filteredApplications.length === 0 ? <p>No applications match these search criteria.</p> : null}
                  <ul className="application-list">
                    {filteredApplications.map(application => (
                      <li key={application.id} className="application-card search-result-card">
                        <button type="button" onClick={() => openApplication(application)} className="application-card-link">
                          <strong>{application.borrower || 'Unnamed borrower'}</strong> — €{application.loanRequested}
                        </button>
                        <div className="application-card-meta">{application.applicantEmail || 'No email'} · {application.location || 'No location'} · {getApplicationDate(application.timestamp) || 'Date unavailable'}</div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
              {selectedApplication ? (
                <article style={panelStyle} className="application-detail-card">
                  <button type="button" className="back-to-results" onClick={() => { setSelectedApplication(null); setEditSuccess(''); }}>← Back to results</button>
                  <h3>Application details</h3>
                  {editingApplication ? (
                    <form onSubmit={handleEditApplication}>
                      <div className="form-grid">
                        <label style={fieldStyle}>Borrower Name<input required value={editForm.borrower} onChange={e => setEditForm({ ...editForm, borrower: e.target.value })} style={inputStyle} /></label>
                        <label style={fieldStyle}>Email<input required type="email" value={editForm.applicantEmail} onChange={e => setEditForm({ ...editForm, applicantEmail: e.target.value })} style={inputStyle} /></label>
                        <label style={fieldStyle}>Phone Number<input required type="tel" value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} style={inputStyle} /></label>
                        <label style={fieldStyle}>Location<input required value={editForm.location} onChange={e => setEditForm({ ...editForm, location: e.target.value })} style={inputStyle} /></label>
                        <label style={fieldStyle} className="loan-field">Loan Requested (€)<input className="loan-requested-input" required type="number" min="1" value={editForm.loanRequested} onChange={e => setEditForm({ ...editForm, loanRequested: e.target.value })} style={inputStyle} /></label>
                      </div>
                      <button type="submit" disabled={editBusy} className="primary-button">{editBusy ? 'Saving...' : 'Save changes'}</button>{' '}
                      <button type="button" disabled={editBusy} onClick={() => setEditingApplication(false)} className="secondary-button">Cancel</button>
                    </form>
                  ) : (
                    <>
                      <dl className="application-detail-list">
                        <div><dt>Borrower Name</dt><dd>{selectedApplication.borrower || 'Not provided'}</dd></div>
                        <div><dt>Email</dt><dd>{selectedApplication.applicantEmail || 'Not provided'}</dd></div>
                        <div><dt>Phone Number</dt><dd>{selectedApplication.phone || 'Not provided'}</dd></div>
                        <div><dt>Location</dt><dd>{selectedApplication.location || 'Not provided'}</dd></div>
                        <div><dt>Loan Requested</dt><dd>€{selectedApplication.loanRequested}</dd></div>
                        <div><dt>Date Submitted</dt><dd>{getApplicationDate(selectedApplication.timestamp) || 'Unavailable'}</dd></div>
                        <div><dt>Status</dt><dd>{selectedApplication.status || 'Applied'}</dd></div>
                      </dl>
                      <div className="application-detail-actions">
                        <button type="button" onClick={startEditingApplication} className="primary-button detail-action-button">Edit</button>
                        <button type="button" onClick={handleDeleteApplication} disabled={deletingApplication} className="delete-application-button detail-action-button">{deletingApplication ? 'Deleting...' : 'Delete'}</button>
                      </div>
                    </>
                  )}
                  {editError ? <p role="alert" className="error-message">{editError}</p> : null}
                  {editSuccess ? <p role="status" className="success-message">{editSuccess}</p> : null}
                </article>
              ) : null}
            </section>
          ) : null}

          {page === 'profile' ? (
            <section>
              <h2 className="page-heading">User Profile</h2>
              <div className="theme-panel">
                <div>
                  <h3>Appearance</h3>
                  <p>Choose light or dark mode. By default, the app follows your browser preference.</p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={theme === 'dark'}
                  aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                  className={`theme-switch ${theme === 'dark' ? 'is-dark' : ''}`}
                  onClick={() => setThemeOverride(theme === 'dark' ? 'light' : 'dark')}
                >
                  <span className="theme-switch-thumb" />
                  <span>{theme === 'dark' ? 'Dark' : 'Light'}</span>
                </button>
              </div>
              <div style={panelStyle} className="profile-card">
                <h3>Account information</h3>
                <p><strong>Email:</strong> {user.email || 'Unavailable'}</p>
                <p><strong>Password:</strong> Managed securely by Firebase; your current password cannot be viewed.</p>
              </div>
              <form onSubmit={handlePasswordChange} style={panelStyle} className="password-form">
                <h3>Change password</h3>
                <label style={fieldStyle}>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} style={inputStyle} required /></label>
                <label style={fieldStyle}>New password<input type="password" autoComplete="new-password" minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} style={inputStyle} required /></label>
                <label style={fieldStyle}>Confirm new password<input type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required /></label>
                <button type="submit" disabled={profileBusy} className="primary-button">{profileBusy ? 'Updating...' : 'Update password'}</button>
                {profileError ? <p role="alert" className="error-message">{profileError}</p> : null}
                {profileSuccess ? <p role="status" className="success-message">{profileSuccess}</p> : null}
              </form>
            </section>
          ) : null}
        </main>
      ) : null}
    </div>
  );
}