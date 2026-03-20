"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
export default function IntakeFormRedirect() { const router = useRouter(); const { id } = useParams<{ id: string }>(); useEffect(() => { router.replace(`/intake-admin/forms/${id}`); }, [router, id]); return <div className="flex items-center justify-center h-96"><p>Redirecting...</p></div>; }
