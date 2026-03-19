import { createServerClient } from "@supabase/ssr";
import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/signup"];
const ONBOARDING_COOKIE = "fg_onboarded";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;
    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const isApiRoute = pathname.startsWith("/api/");
    const isOnboardingRoute = pathname.startsWith("/onboarding");

    if (!user && !isPublicRoute && !isApiRoute) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (user && (pathname === "/login" || pathname === "/signup")) {
      const chatUrl = request.nextUrl.clone();
      chatUrl.pathname = "/chat";
      return NextResponse.redirect(chatUrl);
    }

    // Onboarding gate: redirect unboarded users to /onboarding/chat.
    // Skip for public/API/onboarding routes and when the cookie confirms completion.
    if (user && !isPublicRoute && !isApiRoute && !isOnboardingRoute) {
      const cachedOnboarded = request.cookies.get(ONBOARDING_COOKIE)?.value === "1";

      if (!cachedOnboarded) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("onboarding_completed")
          .eq("user_id", user.id)
          .single();

        if (profile && !profile.onboarding_completed) {
          const onboardingUrl = request.nextUrl.clone();
          onboardingUrl.pathname = "/onboarding/chat";
          return NextResponse.redirect(onboardingUrl);
        }

        // Onboarding is done — set the cookie so we skip this check next time
        if (profile?.onboarding_completed) {
          supabaseResponse.cookies.set(ONBOARDING_COOKIE, "1", {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
          });
        }
      }
    }

    return supabaseResponse;
  } catch (err: unknown) {
    throw err;
  }
}
