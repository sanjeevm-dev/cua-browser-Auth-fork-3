import { Appearance } from '@clerk/types';

export const clerkDarkTheme: Appearance = {
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'iconButton',
  },
  variables: {
    colorPrimary: '#3b82f6',
    colorBackground: '#0a0a0a',
    colorInputBackground: 'rgba(255, 255, 255, 0.03)',
    colorInputText: '#ffffff',
    colorText: '#ffffff',
    colorTextSecondary: '#9ca3af',
    colorDanger: '#ef4444',
    colorSuccess: '#10b981',
    colorWarning: '#f59e0b',
    borderRadius: '0.75rem',
    fontFamily: 'var(--font-inter), system-ui, sans-serif',
  },
  elements: {
    formButtonPrimary: 
      'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-semibold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200',
    
    formButtonReset: 
      'bg-white/[0.02] border border-white/[0.08] text-white hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200',
    
    card: 
      'bg-[#0a0a0a] border border-white/[0.08] shadow-2xl backdrop-blur-xl',
    
    rootBox: 
      'flex items-center justify-center',
    
    headerTitle: 
      'text-white font-semibold text-2xl',
    
    headerSubtitle: 
      'text-gray-400 text-sm',
    
    socialButtonsBlockButton: 
      'bg-white/[0.03] border border-white/[0.08] text-white hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-200',
    
    socialButtonsBlockButtonText: 
      'text-white font-medium',
    
    dividerLine: 
      'bg-white/[0.08]',
    
    dividerText: 
      'text-gray-500 text-sm',
    
    formFieldLabel: 
      'text-gray-300 font-medium text-sm',
    
    formFieldInput: 
      'bg-white/[0.03] border border-white/[0.08] text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200',
    
    formFieldInputShowPasswordButton: 
      'text-gray-400 hover:text-gray-300',
    
    footerActionLink: 
      'text-blue-400 hover:text-blue-300 font-medium transition-colors',
    
    footerActionText: 
      'text-gray-400 text-sm',
    
    identityPreviewText: 
      'text-white',
    
    identityPreviewEditButton: 
      'text-blue-400 hover:text-blue-300',
    
    formHeaderTitle: 
      'text-white font-semibold text-xl',
    
    formHeaderSubtitle: 
      'text-gray-400 text-sm',
    
    otpCodeFieldInput: 
      'bg-white/[0.03] border border-white/[0.08] text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all duration-200',
    
    formResendCodeLink: 
      'text-blue-400 hover:text-blue-300 font-medium transition-colors',
    
    footer: 
      'bg-[#0a0a0a] border-t border-white/[0.08]',
    
    footerPagesLink: 
      'text-blue-400 hover:text-blue-300',
    
    modalContent: 
      'bg-[#0a0a0a] border border-white/[0.08]',
    
    modalCloseButton: 
      'text-gray-400 hover:text-gray-300',
    
    alertText: 
      'text-sm text-gray-300',
    
    formFieldErrorText: 
      'text-red-400 text-sm',
    
    identifierText: 
      'text-white',
    
    profileSectionPrimaryButton: 
      'bg-gradient-to-br from-blue-500 to-purple-600 hover:from-blue-400 hover:to-purple-500 text-white font-semibold',
    
    badge: 
      'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    
    userButtonPopoverCard: 
      'bg-[#0a0a0a] border border-white/[0.08] shadow-2xl backdrop-blur-xl',
    
    userButtonPopoverActionButton: 
      'text-white hover:bg-white/[0.05] transition-all duration-200',
    
    userButtonPopoverActionButtonText: 
      'text-white font-medium',
    
    userButtonPopoverActionButtonIcon: 
      'text-gray-400',
    
    userButtonPopoverFooter: 
      'hidden',
    
    userPreviewMainIdentifier: 
      'text-white font-semibold',
    
    userPreviewSecondaryIdentifier: 
      'text-gray-400 text-sm',
    
    userButtonBox: 
      'border-2 border-white/[0.08] hover:border-white/[0.12] transition-all duration-200',
    
    avatarBox: 
      'w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600',
    
    avatarImage: 
      'w-10 h-10 rounded-full object-cover',
    
    userButtonAvatarBox: 
      'w-10 h-10 rounded-full',
    
    userButtonAvatarImage: 
      'w-10 h-10 rounded-full',
  },
};
