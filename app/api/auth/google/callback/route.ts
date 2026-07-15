import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`,
);

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json(
      {
        error: "Missing authorization code.",
      },
      { status: 400 },
    );
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);

    console.log("====================================");
    console.log("GOOGLE TOKENS");
    console.log("====================================");
    console.log(tokens);
    console.log("Refresh Token:", tokens.refresh_token);
    console.log("Access Token:", tokens.access_token);
    console.log("====================================");

    return NextResponse.json({
      success: true,
      message:
        "Tokens received. Copy the refresh_token from the server logs.",
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to exchange authorization code.",
      },
      { status: 500 },
    );
  }
}