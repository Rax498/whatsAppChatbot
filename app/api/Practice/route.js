import { RistaApi } from "@/utils/summary";
import { NextResponse } from "next/server";
const RISTA_TOKEN = process.env.RISTA_TOKEN;

export const POST = async (req) => {
  try {
    const body = await req.json();
    const ristaResponse = await RistaApi(body.req);
    console.log(ristaResponse);
    return NextResponse.json(ristaResponse);
  } catch (error) {
    return NextResponse.json({ "Api returned error": error.message });
  }
};
