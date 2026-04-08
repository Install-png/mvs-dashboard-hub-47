import { Outlet } from "react-router-dom";
import AppSidebar from "./AppSidebar";
import MobileNav from "./MobileNav";
import { useEffect } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { CYRILLIC_FONT } from "@/lib/cyrillic-font";

const DashboardLayout = () => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "P") {
        e.preventDefault();
        const el = document.getElementById("main-content");
        if (!el) return;
        html2canvas(el, { scale: 1.5 }).then((canvas) => {
          const pdf = new jsPDF("l", "mm", "a4");
          pdf.addFileToVFS("Roboto-Regular.ttf", CYRILLIC_FONT);
          pdf.addFont("Roboto-Regular.ttf", "Roboto", "normal");
          pdf.setFont("Roboto");
          const imgData = canvas.toDataURL("image/png");
          const w = pdf.internal.pageSize.getWidth();
          const h = (canvas.height * w) / canvas.width;
          pdf.addImage(imgData, "PNG", 0, 0, w, h);
          pdf.save(`dashboard-${new Date().toISOString().slice(0, 10)}.pdf`);
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar />
      <main id="main-content" className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
};

export default DashboardLayout;
