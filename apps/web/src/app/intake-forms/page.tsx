"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function IntakeFormsRedirect() { const router = useRouter(); useEffect(() => { router.replace("/intake-admin/forms"); }, [router]); return <div className="flex items-center justify-center h-96"><p>Redirecting...</p></div>; }
