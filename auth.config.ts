import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — no Prisma/Node.js APIs
export const authConfig: NextAuthConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";

      if (isLoggedIn && isLoginPage) return Response.redirect(new URL("/dashboard", nextUrl));
      if (!isLoggedIn && !isLoginPage) return false;
      return true;
    },
  },
};
