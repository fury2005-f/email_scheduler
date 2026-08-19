import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || 'unconfigured-google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'unconfigured-google-client-secret',
    }),
    CredentialsProvider({
      id: 'credentials',
      name: 'ReachInbox Admin Account',
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
