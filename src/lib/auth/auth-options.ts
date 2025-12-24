import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import type { Role } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: Role
      employeeId: string
      stores: { id: string; name: string; isPrimary: boolean }[]
    }
  }

  interface User {
    id: string
    email: string
    name: string
    role: Role
    employeeId: string
    stores: { id: string; name: string; isPrimary: boolean }[]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: Role
    employeeId: string
    stores: { id: string; name: string; isPrimary: boolean }[]
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        employeeId: { label: "員工編號", type: "text" },
        password: { label: "密碼", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.employeeId || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: { employeeId: credentials.employeeId },
          include: {
            stores: {
              include: {
                store: true,
              },
            },
          },
        })

        if (!user || user.status !== "ACTIVE") {
          return null
        }

        const isValid = await compare(credentials.password, user.passwordHash)
        if (!isValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          employeeId: user.employeeId,
          stores: user.stores.map((us) => ({
            id: us.store.id,
            name: us.store.name,
            isPrimary: us.isPrimary,
          })),
        }
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role
        token.employeeId = user.employeeId
        token.stores = user.stores
      }
      return token
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role
        session.user.employeeId = token.employeeId
        session.user.stores = token.stores
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 hours
  },
}
