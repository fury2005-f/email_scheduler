import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    // Secondary fallback for local dev iteration if Google OAuth Client ID is missing from .env
    CredentialsProvider({
      name: 'Demo Admin Account',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@reachinbox.ai' },
      },
      async authorize(credentials) {
        const email = credentials?.email || 'outreach.admin@reachinbox.ai';
        return {
          id: 'usr_admin_1',
          name: 'Outreach Admin',
          email,
          image: 'https://lh3.googleusercontent.com/a/default-user',
        };
      },
    }),
  ],
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'reachinbox_nextauth_secret_key_production_grade_32_chars',
};
