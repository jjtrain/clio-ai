"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface DeptContextType {
  activeDepartmentId: string | null;
  activeDepartment: any | null;
  departments: any[];
  switchDepartment: (id: string | null) => void;
}

const DeptContext = createContext<DeptContextType>({
  activeDepartmentId: null, activeDepartment: null, departments: [], switchDepartment: () => {}
});

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const [activeDepartmentId, setActiveDepartmentId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("active-dept");
    return null;
  });
  const [departments, setDepartments] = useState<any[]>([]);

  useEffect(() => {
    if (activeDepartmentId) localStorage.setItem("active-dept", activeDepartmentId);
    else localStorage.removeItem("active-dept");
  }, [activeDepartmentId]);

  const activeDepartment = departments.find(d => d.id === activeDepartmentId) ?? null;
  const switchDepartment = (id: string | null) => setActiveDepartmentId(id);

  return (
    <DeptContext.Provider value={{ activeDepartmentId, activeDepartment, departments, switchDepartment }}>
      {children}
    </DeptContext.Provider>
  );
}

export const useDepartment = () => useContext(DeptContext);
