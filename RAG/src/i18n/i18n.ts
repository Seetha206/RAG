const strings: Record<string, string> = {
  // Global
  'app.global.error': 'Something went wrong. Please try again.',
  'app.global.loading': 'Loading...',
  'app.global.noData': 'No data available',
  'app.global.search': 'Search...',
  'app.global.confirm': 'Are you sure?',

  // Buttons
  'app.button.save': 'Save',
  'app.button.cancel': 'Cancel',
  'app.button.delete': 'Delete',
  'app.button.confirm': 'Confirm',
  'app.button.back': 'Back',
  'app.button.submit': 'Submit',
  'app.button.edit': 'Edit',
  'app.button.close': 'Close',

  // Auth
  'app.auth.login': 'Log In',
  'app.auth.signup': 'Sign Up',
  'app.auth.logout': 'Log Out',
  'app.auth.forgotPassword': 'Forgot Password?',
  'app.auth.resetPassword': 'Reset Password',
  'app.auth.emailPlaceholder': 'Enter your email',
  'app.auth.passwordPlaceholder': 'Enter your password',
  'app.auth.confirmPasswordPlaceholder': 'Confirm your password',
  'app.auth.firstNamePlaceholder': 'First name',
  'app.auth.lastNamePlaceholder': 'Last name',
  'app.auth.loginSuccess': 'Logged in successfully',
  'app.auth.logoutSuccess': 'Logged out successfully',
  'app.auth.signupSuccess': 'Account created successfully',
  'app.auth.resetPasswordSuccess': 'Password reset successfully',
  'app.auth.forgotPasswordSuccess': 'Password reset link sent to your email',

  // Profile
  'app.profile.title': 'My Profile',
  'app.profile.updateSuccess': 'Profile updated successfully',
  'app.profile.updateError': 'Failed to update profile',
  'app.profile.info': 'Profile Information',

  // Organization
  'app.org.title': 'Organization',
  'app.org.members': 'Members',
  'app.org.invite': 'Invite Member',
  'app.org.inviteSuccess': 'Invitation sent successfully',
  'app.org.removeSuccess': 'Member removed successfully',
  'app.org.createSuccess': 'Organization created successfully',

  // Validation
  'app.validation.required': 'This field is required',
  'app.validation.email': 'Please enter a valid email address',
  'app.validation.passwordMin': 'Password must be at least 8 characters',
  'app.validation.passwordMatch': 'Passwords do not match',
  'app.validation.nameMin': 'Must be at least 2 characters',
  'app.validation.fileTooLarge': 'File size exceeds the maximum limit',
  'app.validation.invalidFileType': 'File type is not supported',
};

export const t = (key: string, fallback?: string): string => {
  return strings[key] ?? fallback ?? key;
};

export default strings;
