Functionality overview:

This is a small React prototype for an AL Agentic Lender loan-origination pipeline. It lets a user submit a test loan application and view applications stored in Firebase Firestore.

How it works:

App startup: main.jsx mounts the React application into the page’s root element and wraps it in React.StrictMode.
Firebase connection: firebase.js initializes Firebase with the project configuration and exports a Firestore database connection.
Loading applications: App.jsx subscribes to the Firestore applications collection while a user is signed in. Firestore supplies the current documents and sends updates as the collection changes, including after a page refresh.
Submitting an application: The form collects a borrower name, applicant email, phone number, location, and requested loan amount. On submission, it adds a document to applications with an initial "Applied" status and a server-generated timestamp. After Firestore confirms the write, the form is cleared and the submit button is re-enabled.
Navigation and search: Signed-in users can navigate between the active pipeline, application search, and their profile. Search filters the subscribed applications by borrower, email, phone, location, requested amount range, and submission date. Selecting a result opens its details, where the application fields can be edited or the application can be deleted after confirmation.
User profile: The profile displays the signed-in email and provides a password-change form that reauthenticates the user. Firebase does not expose existing passwords, so the current password is never displayed.
The project uses React and Firebase, with Vite for development and production builds, as configured in package.json. The page’s HTML entry point is index.html.

Scope:
Despite the “Agentic Lender” name, this code currently implements basic application submission and listing alongside Firebase email-and-password registration, sign-in, and sign-out. It does not perform loan assessment or update application statuses.

Authentication:
Enable the Email/Password provider in the Firebase Console under Authentication > Sign-in method before using these features. The application UI requires sign-in to access the loan pipeline, but that alone does not secure Firestore. Configure Firestore Security Rules to enforce access control for database reads and writes.

Firestore access: This prototype uses a shared application pipeline: any signed-in user can search, edit, and delete all application records, including contact information. To enable its current features, Firestore rules for `applications` must permit signed-in users to read, create, update, and delete documents. For example:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /applications/{applicationId} {
      allow read, create, update, delete: if request.auth != null;
    }
  }
}
```

Publish rules in Firebase Console under Firestore Database > Rules. This shared-access rule is suitable only when all signed-in users are trusted to access, modify, and permanently delete every application's personal data. Search currently filters the subscribed collection in the browser, so a large production dataset should use server-side Firestore queries and a stricter access design.

chicken