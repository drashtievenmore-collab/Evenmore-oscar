import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  Users,
  User,
  Receipt,
  Download,
  Eye,
  CheckCircle2,
  Plus,
  Search,
  X,
  ChevronRight,
  Check,
  CreditCard,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  Edit3,
  Printer,
  FileText,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { useAppStore } from "../../../stores/appStore";
import {
  usePayrollStore,
  getDepartmentDays,
  getDepartmentHours,
  DEFAULT_DEPARTMENT_WORKING_DAYS,
  DEFAULT_DEPARTMENT_WORKING_HOURS,
  WORKFLOW_STAGES,
} from "../../../stores/payrollStore";
import {
  calculateSalaryComponents,
  aggregatePayrollStats,
  formatINR,
} from "./salaryCalculations";
import { Badge } from "../../../components/hrms/Badge";
import PageHeader from "../../../components/ui/PageHeader";
import { hrmsGuides } from "../../../data/hrms/hrmsGuides";

// Clean browser PDF payslip generator with full formula breakdown
function downloadPayslipPdf(p) {
  const clean = (s) =>
    String(s || "")
      .replace(/[()\\]/g, "")
      .replace(/[₹•–—]/g, "-")
      .replace(/[^\x20-\x7E]/g, " ");

  const name = clean(p.name || "EMPLOYEE").toUpperCase();
  const id = clean(p.id || "PAY-000");
  const empId = clean(p.empId || "EMP-000");
  const role = clean(p.role || "Team Member");
  const dept = clean(p.department || "General");
  const month = clean(p.month || "October 2024");
  const bank = clean(p.bank || "Direct Deposit Verified");

  const std = Number(p.standardSalary || 0);
  const totalD = Number(p.totalDays || 24);
  const dailyH = Number(p.dailyHours || 8);
  const totalH = Number(p.totalHours || (totalD * dailyH));
  const hourlyR = Number(p.hourlyRate || (totalH > 0 ? Math.round(std / totalH) : 0));
  const attended = p.attendedDays !== undefined ? Number(p.attendedDays) : totalD;
  const absent = p.absentDays !== undefined ? Number(p.absentDays) : Math.max(0, totalD - attended);
  const perDay = p.perDaySalary !== undefined ? Number(p.perDaySalary) : (totalD > 0 ? Math.round(std / totalD) : 0);
  const attDeduction = p.attendanceDeduction !== undefined ? Number(p.attendanceDeduction) : Math.round(perDay * absent);
  const earned = p.earnedSalary !== undefined ? Number(p.earnedSalary) : Math.max(0, std - attDeduction);
  const earnings = Number(p.additionalEarnings || 0);
  const deductions = Number(p.deductions || 0);
  const advance = Number(p.advance || 0);
  const remaining = Math.max(0, earned + earnings - deductions - advance);
  const basic = Number(p.basic || Math.round(earned * 0.6));
  const hra = Number(p.hra || Math.round(earned * 0.25));
  const allowances = Number(p.allowances || Math.max(0, earned - basic - hra));
  const status = clean(p.status || "In Progress");
  const paidDate = clean(p.paymentDate || "N/A");
  const paidAmt = p.paidAmount !== null && p.paidAmount !== undefined ? Number(p.paidAmount) : remaining;

  const lines = [
    "BT",
    "/F1 18 Tf",
    "50 780 Td",
    "(EVENMORE ERP - CONFIDENTIAL SALARY SLIP) Tj",
    "/F1 10 Tf",
    "0 -22 Td",
    `(Pay Period: ${month}   |   Slip Ref: ${id}   |   Status: ${status}) Tj`,
    "0 -18 Td",
    `(Employee: ${name}   |   Staff ID: ${empId}) Tj`,
    "0 -16 Td",
    `(Designation: ${role}   |   Department: ${dept}) Tj`,
    "0 -16 Td",
    `(Disbursal Bank: ${bank}) Tj`,
    "0 -26 Td",
    "/F1 12 Tf",
    "(MONTHLY SALARY CALCULATION BREAKDOWN:) Tj",
    "0 -18 Td",
    "/F1 10 Tf",
    `(Standard Agreed Monthly CTC: INR ${std.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(Attendance: ${attended} of ${totalD} Days Present | ${absent} Absent | Hours: ${dailyH}h/d [Target: ${totalH}h]) Tj`,
    "0 -16 Td",
    `(Rate: INR ${perDay.toLocaleString()}/day [INR ${hourlyR.toLocaleString()}/hr] | LOP Removed: (-) INR ${attDeduction.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(Earned Base Salary: INR ${earned.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(Basic Salary [60%]: INR ${basic.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(House Rent Allowance [HRA 25%]: INR ${hra.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(Special & Flexible Allowances: INR ${allowances.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(Additional Earnings [Overtime & Incentives]: (+) INR ${earnings.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(Deductions [PF, Taxes, Statutory]: (-) INR ${deductions.toLocaleString()}) Tj`,
    "0 -16 Td",
    `(Salary Advance Recovered: (-) INR ${advance.toLocaleString()}) Tj`,
    "0 -24 Td",
    "/F1 11 Tf",
    "(FORMULA: Net Salary = Standard CTC - Attendance LOP + Earnings - Deductions - Advance) Tj",
    "0 -22 Td",
    "/F1 14 Tf",
    `(NET REMAINING PAYABLE: INR ${remaining.toLocaleString()}) Tj`,
    "0 -24 Td",
    "/F1 10 Tf",
    `(Payout Status: ${status}   |   Disbursed: INR ${paidAmt.toLocaleString()}   |   Date: ${paidDate}) Tj`,
    "0 -32 Td",
    "/F1 9 Tf",
    "(This is a verified computer-generated salary slip adhering to HRMS payroll compliance.) Tj",
    "0 -14 Td",
    "(Evenmore ERP Technologies Pvt Ltd - Digitally Certified & Verified.) Tj",
    "ET",
  ];

  const stream = lines.join("\n");
  const streamBytes = new TextEncoder().encode(stream).length;

  let out = "%PDF-1.4\n";
  const offsets = [];

  function addObj(content) {
    offsets.push(new TextEncoder().encode(out).length);
    out += content + "\n";
  }

  addObj("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj");
  addObj("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj");
  addObj("3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj");
  addObj(`4 0 obj\n<< /Length ${streamBytes} >>\nstream\n${stream}\nendstream\nendobj`);
  addObj("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj");

  const startXref = new TextEncoder().encode(out).length;
  out += "xref\n0 " + (offsets.length + 1) + "\n0000000000 65535 f \n";
  for (const off of offsets) {
    out += String(off).padStart(10, "0") + " 00000 n \n";
  }
  out += "trailer\n<< /Size " + (offsets.length + 1) + " /Root 1 0 R >>\nstartxref\n" + startXref + "\n%%EOF";

  const blob = new Blob([out], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Payslip_${(p.name || "Employee").replace(/\s+/g, "_")}_${month.replace(/\s+/g, "_")}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Modern printable/save-as-PDF window generator with corporate styling
function printPayslip(p) {
  const std = Number(p.standardSalary || 0);
  const totalD = Number(p.totalDays || 24);
  const dailyH = Number(p.dailyHours || 8);
  const totalH = Number(p.totalHours || (totalD * dailyH));
  const hourlyR = Number(p.hourlyRate || (totalH > 0 ? Math.round(std / totalH) : 0));
  const attended = p.attendedDays !== undefined ? Number(p.attendedDays) : totalD;
  const absent = p.absentDays !== undefined ? Number(p.absentDays) : Math.max(0, totalD - attended);
  const perDay = p.perDaySalary !== undefined ? Number(p.perDaySalary) : (totalD > 0 ? Math.round(std / totalD) : 0);
  const attDeduction = p.attendanceDeduction !== undefined ? Number(p.attendanceDeduction) : Math.round(perDay * absent);
  const earned = p.earnedSalary !== undefined ? Number(p.earnedSalary) : Math.max(0, std - attDeduction);
  const earnings = Number(p.additionalEarnings || 0);
  const deductions = Number(p.deductions || 0);
  const advance = Number(p.advance || 0);
  const remaining = Math.max(0, earned + earnings - deductions - advance);
  const basic = Number(p.basic || Math.round(earned * 0.6));
  const hra = Number(p.hra || Math.round(earned * 0.25));
  const allowances = Number(p.allowances || Math.max(0, earned - basic - hra));
  const month = p.month || "October 2024";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Payslip - ${p.name} - ${month}</title>
        <style>
          @page { size: A4; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
          .logo { font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }
          .subtitle { font-size: 12px; color: #64748b; }
          .badge { background: #dcfce7; color: #15803d; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; display: inline-block; }
          .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
          .label { font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
          .val { font-size: 13.5px; font-weight: 700; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 12px; font-weight: 700; color: #334155; border: 1px solid #cbd5e1; }
          td { padding: 8px 12px; font-size: 12.5px; border: 1px solid #e2e8f0; }
          .num { text-align: right; font-weight: 600; }
          .formula-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 20px; }
          .net-payable { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 14px 18px; border-radius: 8px; font-size: 16px; font-weight: 800; }
          .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">EVENMORE TECHNOLOGIES</div>
            <div class="subtitle">CONFIDENTIAL SALARY STATEMENT • CORPORATE HRMS</div>
          </div>
          <div style="text-align: right;">
            <span class="badge">${p.status || "Paid"}</span>
            <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Pay Period: ${month}</div>
          </div>
        </div>

        <div class="grid-2">
          <div class="box">
            <div class="label">Employee Details</div>
            <div class="val">${p.name}</div>
            <div style="color: #475569; font-size: 12px; margin-top: 2px;">${p.role} • ${p.department}</div>
            <div style="color: #64748b; font-size: 11.5px; margin-top: 4px;">Staff ID: ${p.empId || "EMP1000"} | Slip Ref: ${p.id || "PAY-100"}</div>
          </div>
          <div class="box">
            <div class="label">Disbursal & Attendance</div>
            <div class="val">${p.bank || "Direct Deposit (Verified)"}</div>
            <div style="color: #475569; font-size: 12px; margin-top: 2px;">Working Schedule: ${attended} Present / ${totalD} Days (${absent}d absent) • ${dailyH}h/day (${totalH}h target)</div>
            <div style="color: #64748b; font-size: 11.5px; margin-top: 4px;">Disbursement Date: ${p.paymentDate || "Oct 31, 2024"} • Rate: INR ${perDay}/day (INR ${hourlyR}/hr)</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>EARNINGS</th>
              <th class="num">AMOUNT (INR)</th>
              <th>DEDUCTIONS & RECOVERIES</th>
              <th class="num">AMOUNT (INR)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary (60%)</td>
              <td class="num">${basic.toLocaleString()}</td>
              <td>Attendance LOP (${absent} days absent @ INR ${perDay}/d)</td>
              <td class="num" style="color: #b91c1c;">-${attDeduction.toLocaleString()}</td>
            </tr>
            <tr>
              <td>House Rent Allowance (HRA 25%)</td>
              <td class="num">${hra.toLocaleString()}</td>
              <td>Salary Advance Recovered</td>
              <td class="num" style="color: #b45309;">-${advance.toLocaleString()}</td>
            </tr>
            <tr>
              <td>Special & Flexible Allowances</td>
              <td class="num">${allowances.toLocaleString()}</td>
              <td>Provident Fund (PF)</td>
              <td class="num">${Math.round(deductions * 0.55).toLocaleString()}</td>
            </tr>
            <tr>
              <td>Additional Earnings / Overtime / Bonus</td>
              <td class="num">+${earnings.toLocaleString()}</td>
              <td>Tax Deducted at Source (TDS) / PT</td>
              <td class="num">${Math.round(deductions * 0.45).toLocaleString()}</td>
            </tr>
            <tr style="font-weight: 700; background: #f8fafc;">
              <td>Earned Base Salary</td>
              <td class="num" style="color: #1e40af;">INR ${earned.toLocaleString()}</td>
              <td>Total Deductions & Advances</td>
              <td class="num" style="color: #b91c1c;">-INR ${(deductions + advance + attDeduction).toLocaleString()}</td>
            </tr>
            <tr style="font-weight: 700; background: #f8fafc;">
              <td>Standard Agreed CTC</td>
              <td class="num">INR ${std.toLocaleString()}</td>
              <td>Total In-Hand Payable</td>
              <td class="num" style="color: #15803d;">INR ${remaining.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>

        <div class="formula-box">
          <div style="font-weight: 700; font-size: 11.5px; color: #15803d; margin-bottom: 2px;">FORMULA AUDIT TRAIL:</div>
          <div style="font-size: 12px; color: #334155;">
            Remaining Payable = Standard CTC (INR ${std.toLocaleString()}) - Attendance LOP (INR ${attDeduction.toLocaleString()} for ${absent} absent days) + Additional Earnings (INR ${earnings.toLocaleString()}) - Statutory Deductions (INR ${deductions.toLocaleString()}) - Salary Advance Recovered (INR ${advance.toLocaleString()})
          </div>
        </div>

        <div class="net-payable">
          <span>NET TAKE-HOME PAYABLE</span>
          <span>INR ${remaining.toLocaleString()}</span>
        </div>

        <div class="footer">
          <div>This is a digitally certified salary slip generated by Evenmore ERP HRMS.</div>
          <div>Authorized Signatory: Head of Payroll & Finance</div>
        </div>
      </body>
    </html>
  `;

  const printWindow = window.open("", "_blank", "width=850,height=900");
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 400);
  }
}

export default function Payroll() {
  const showToast = useAppStore((s) => s.showToast);
  const storeLeaves = useAppStore((s) => s.leaves || []);
  const storeEncashments = useAppStore((s) => s.encashments || []);
  const currentUser = useAppStore((s) => s.currentUser) || {
    name: "Adarsh Gupta",
    role: "Operations Admin",
    email: "admin@evenmore.io",
  };

  const {
    employees: payrollEmployees,
    structures,
    workflowStep,
    currentPeriod,
    defaultWorkingDays = 24,
    departmentWorkingDays = DEFAULT_DEPARTMENT_WORKING_DAYS,
    departmentWorkingHours = DEFAULT_DEPARTMENT_WORKING_HOURS,
    setDepartmentWorkingDays,
    setDepartmentWorkingHours,
    setWorkflowStep,
    setCurrentPeriod,
    setDefaultWorkingDays,
    markEmployeePaid,
    disburseDepartment,
    runPayrollForAll,
    updateEmployeePayroll,
    addStructure,
    ownHistory: ownSalaryHistory = [],
    loadOwnHistory,
  } = usePayrollStore();

  // The "My Salary" tab shows this user's own payslips, read by employee id.
  useEffect(() => {
    if (currentUser?.employeeId || currentUser?.id) {
      loadOwnHistory?.(currentUser.employeeId || currentUser.id);
    }
  }, [currentUser?.employeeId, currentUser?.id, loadOwnHistory]);

  // Primary 4 views: 'overall' | 'department' | 'employee' | 'own'
  const [activeTab, setActiveTab] = useState("overall");

  // Filters for Employee-wise tab
  const [empSearch, setEmpSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  // Modals state
  const [selectedPayslip, setSelectedPayslip] = useState(null);
  const [showRunModal, setShowRunModal] = useState(false);
  const [runSuccess, setRunSuccess] = useState(false);
  const [showAddStructureModal, setShowAddStructureModal] = useState(false);
  const [newStructure, setNewStructure] = useState({ name: "", department: "Engineering", employees: "" });

  // Lifecycle transition & Payslip generator modal state
  const [showLifecycleModal, setShowLifecycleModal] = useState(false);
  const [targetStage, setTargetStage] = useState(null);
  const [showGenerateSlipModal, setShowGenerateSlipModal] = useState(false);
  const [slipSelectedEmpId, setSlipSelectedEmpId] = useState("");
  const [slipPickerOpen, setSlipPickerOpen] = useState(false);
  const [slipSearchQuery, setSlipSearchQuery] = useState("");

  // Quick edit advance & attendance modal
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [editTotalDays, setEditTotalDays] = useState(24);
  const [editDailyHours, setEditDailyHours] = useState(8);
  const [editAttendedDays, setEditAttendedDays] = useState(20);
  const [editAdvance, setEditAdvance] = useState(0);
  const [editEarnings, setEditEarnings] = useState(0);
  const [editDeductions, setEditDeductions] = useState(0);

  // Switcher for Own Salary perspective
  const [activeOwnUser, setActiveOwnUser] = useState(currentUser?.name || "Adarsh Gupta");

  // Dynamic calculations with approved leaves & attendance integration
  const computedEmployeePayrolls = useMemo(() => {
    return payrollEmployees.map((p) => {
      const empLeaves = storeLeaves.filter(
        (l) => l.employee?.toLowerCase() === String(p.name ?? '').toLowerCase() && l.status?.includes("Approved")
      );
      const leaveDays = empLeaves.reduce((sum, l) => sum + (Number(l.days) || 1), 0);

      const totalDays = Number(p.totalDays) || Number(defaultWorkingDays) || 24;
      const attendedDays = p.attendedDays !== undefined ? Number(p.attendedDays) : totalDays;

      const deptHours = getDepartmentHours(departmentWorkingHours, p.department);
      const dailyHours = Number(p.dailyHours) || deptHours || 8;
      const totalHours = Number(p.totalHours) || (totalDays * dailyHours);
      const hourlyRate = Number(p.hourlyRate) || (totalHours > 0 ? Math.round(Number(p.standardSalary || 0) / totalHours) : 0);

      const empApprovedEncashments = storeEncashments.filter(
        (enc) => enc.employee?.toLowerCase() === p.name?.toLowerCase() && enc.status === "Approved"
      );
      const encashmentBonus = empApprovedEncashments.reduce((sum, enc) => sum + (Number(enc.amount) || 0), 0);
      const baseEarnings = p.additionalEarnings !== undefined ? p.additionalEarnings : (p.overtime || 0);
      const effectiveEarnings = baseEarnings + encashmentBonus;

      // Calculation matrix from reusable engine
      const calc = calculateSalaryComponents({
        standardSalary: p.standardSalary,
        totalDays: totalDays,
        attendedDays: attendedDays,
        paidLeaves: leaveDays,
        additionalEarnings: effectiveEarnings,
        deductions: p.deductions,
        advance: p.advance !== undefined ? p.advance : 0,
        status: p.status || "In Progress",
        paidAmount: p.paidAmount,
        paymentDate: p.paymentDate,
      });

      return {
        ...p,
        ...calc,
        leaveDays,
        dailyHours,
        totalHours,
        hourlyRate,
        encashmentBonus,
      };
    });
  }, [payrollEmployees, storeLeaves, storeEncashments, defaultWorkingDays, departmentWorkingHours]);

  // Selected employee for generate payslip modal
  const slipSelectedEmp = useMemo(() => {
    if (!slipSelectedEmpId) return computedEmployeePayrolls[0];
    return (
      computedEmployeePayrolls.find((e) => e.id === slipSelectedEmpId) ||
      computedEmployeePayrolls[0]
    );
  }, [computedEmployeePayrolls, slipSelectedEmpId]);

  // Filtered employees for slip modal picker search
  const filteredPickerEmployees = useMemo(() => {
    if (!slipSearchQuery.trim()) return computedEmployeePayrolls;
    const q = slipSearchQuery.toLowerCase().trim();
    return computedEmployeePayrolls.filter(
      (e) =>
        e.name?.toLowerCase().includes(q) ||
        e.role?.toLowerCase().includes(q) ||
        e.department?.toLowerCase().includes(q) ||
        e.empId?.toLowerCase().includes(q) ||
        e.id?.toLowerCase().includes(q)
    );
  }, [computedEmployeePayrolls, slipSearchQuery]);

  // Overall Statistics Aggregation
  const overallStats = useMemo(() => {
    return aggregatePayrollStats(computedEmployeePayrolls);
  }, [computedEmployeePayrolls]);

  // Department-wise Grouping
  const departmentPayrolls = useMemo(() => {
    const groups = {};
    computedEmployeePayrolls.forEach((p) => {
      const d = p.department || "General";
      if (!groups[d]) {
        groups[d] = {
          name: d,
          employees: [],
          totalStandard: 0,
          totalEarned: 0,
          totalEarnings: 0,
          totalDeductions: 0,
          totalAdvance: 0,
          totalRemaining: 0,
          paidCount: 0,
        };
      }
      groups[d].employees.push(p);
      groups[d].totalStandard += p.standardSalary;
      groups[d].totalEarned += p.earnedSalary;
      groups[d].totalEarnings += p.additionalEarnings;
      groups[d].totalDeductions += p.deductions;
      groups[d].totalAdvance += p.advance;
      groups[d].totalRemaining += p.remainingPayable;
      if (p.status === "Paid") groups[d].paidCount += 1;
    });

    return Object.values(groups).map((g) => ({
      ...g,
      headcount: g.employees.length,
      earnedProgress: g.totalStandard > 0 ? Math.round((g.totalEarned / g.totalStandard) * 100) : 100,
      avgSalary: Math.round(g.totalRemaining / (g.employees.length || 1)),
      allPaid: g.paidCount === g.employees.length,
    }));
  }, [computedEmployeePayrolls]);

  // Filtered Employee-wise list
  const filteredEmployees = useMemo(() => {
    return computedEmployeePayrolls.filter((p) => {
      const q = empSearch.toLowerCase();
      const matchSearch =
        String(p.name ?? '').toLowerCase().includes(q) ||
        String(p.role ?? '').toLowerCase().includes(q) ||
        String(p.empId ?? '').toLowerCase().includes(q);
      const matchDept = deptFilter === "All" || p.department === deptFilter;
      const matchStatus = statusFilter === "All" || p.status === statusFilter;
      return matchSearch && matchDept && matchStatus;
    });
  }, [computedEmployeePayrolls, empSearch, deptFilter, statusFilter]);

  // Own Salary Record
  const ownRecord = useMemo(() => {
    return (
      computedEmployeePayrolls.find(
        (p) => String(p.name ?? '').toLowerCase() === activeOwnUser.toLowerCase()
      ) || computedEmployeePayrolls[0]
    );
  }, [computedEmployeePayrolls, activeOwnUser]);

  // Real-world scenario descriptions for each payroll lifecycle stage
  const STAGE_SCENARIOS = {
    "In Progress": {
      title: "Stage 1: Attendance Reconciliation & Draft Calculation",
      description:
        "HR Operations validates daily attendance logs, integrates approved leaves, calculates pro-rated earned salary, and tallies overtime hours and salary advances.",
      actionLabel: "Set to In Progress",
      bullets: [
        "Pro-rated earned salary calculation enabled",
        "Approved leave days synchronized from HRMS",
        "Salary advance recovery deduction applied",
        "Allows adjusting individual employee earnings & deductions",
      ],
    },
    "Ready for Review": {
      title: "Stage 2: Internal Audit & Variance Verification",
      description:
        "Finance Controller audits calculations against CTC budgets, checks statutory tax brackets (TDS, PF, PT), and ensures zero compliance discrepancies.",
      actionLabel: "Submit for Audit Review",
      bullets: [
        "Attendance records locked across all departments",
        "Statutory compliance check (PF, ESI, TDS) verified",
        "Advance recovery ledger verified against employee records",
        "Net remaining payable verified for all staff",
      ],
    },
    "Approved": {
      title: "Stage 3: Executive Sign-off & Bank Authorization",
      description:
        "Director of HR & Chief Financial Officer sign off on the monthly disbursement budget. Authorizes corporate bank treasury to prepare the batch payout file.",
      actionLabel: "Authorize & Approve Budget",
      bullets: [
        "Executive approval stamp applied to payroll cycle",
        "Corporate treasury funds verified for disbursement",
        "Bank NACH / NEFT batch schedule queued",
        "Ready for 1-click month-end disbursal",
      ],
    },
    "Paid": {
      title: "Stage 4: Month-End Bank Disbursal & Payslips",
      description:
        "Corporate banking gateway executes direct deposit batch transfer. All employee accounts are credited, and verified PDF payslips are released.",
      actionLabel: "Execute Payout & Generate Slips",
      bullets: [
        "Disburses net remaining payable to employee bank accounts",
        "Marks all staff records as 'Paid' with current timestamp",
        "Net Remaining Payable cleared to ₹0",
        "Digitally certified PDF payslips generated for download",
      ],
    },
  };

  // Lifecycle flow helper
  const nextWorkflowStep = (current) => {
    const sequence = ["In Progress", "Ready for Review", "Approved", "Paid"];
    const idx = sequence.indexOf(current);
    if (idx !== -1 && idx < sequence.length - 1) {
      return sequence[idx + 1];
    }
    return current;
  };

  // Lifecycle interaction handlers
  const handleStageClick = (stageId) => {
    setTargetStage(stageId);
    setShowLifecycleModal(true);
  };

  const handleAdvanceStage = () => {
    const next = nextWorkflowStep(workflowStep);
    setTargetStage(next);
    setShowLifecycleModal(true);
  };

  const executeStageTransition = (stage) => {
    if (stage === "Paid") {
      runPayrollForAll();
      showToast("Month-End payroll disbursed to all staff! PDF Payslips generated.");
    } else {
      setWorkflowStep(stage);
      // Synchronize employee statuses realistically with the stage
      payrollEmployees.forEach((emp) => {
        if (emp.status !== "Paid") {
          updateEmployeePayroll(emp.id, { status: stage });
        }
      });
      if (stage === "Ready for Review") {
        showToast("Audit Complete: Attendance locked & payroll submitted for review.");
      } else if (stage === "Approved") {
        showToast("Payroll Approved: Disbursement authorized by Director.");
      } else if (stage === "In Progress") {
        showToast("Payroll reopened in In Progress mode for calculations.");
      }
    }
    setShowLifecycleModal(false);
    setTargetStage(null);
  };

  const handleBatchDownloadSlips = () => {
    computedEmployeePayrolls.forEach((emp, i) => {
      setTimeout(() => {
        downloadPayslipPdf(emp);
      }, i * 150);
    });
    showToast(`Generating and downloading PDF payslips for all ${computedEmployeePayrolls.length} employees...`);
  };

  // Handlers
  const handleRunPayroll = () => {
    setRunSuccess(true);
    setTimeout(() => {
      setRunSuccess(false);
      setShowRunModal(false);
      runPayrollForAll();
      showToast("Month-End payroll processed and disbursed for all staff!");
    }, 1200);
  };

  const handleAddStructureSubmit = (e) => {
    e.preventDefault();
    if (!newStructure.name) return;
    addStructure({
      name: newStructure.name,
      department: newStructure.department,
      employees: Number(newStructure.employees) || 12,
    });
    setNewStructure({ name: "", department: "Engineering", employees: "" });
    setShowAddStructureModal(false);
    showToast("New salary structure added successfully");
  };

  const openEditModal = (emp) => {
    setEditingEmployee(emp);
    const deptDefault = getDepartmentDays(departmentWorkingDays, emp.department);
    const deptHoursDefault = getDepartmentHours(departmentWorkingHours, emp.department);
    const totalD = emp.totalDays || deptDefault || 24;
    const dailyH = emp.dailyHours || deptHoursDefault || 8;
    setEditTotalDays(totalD);
    setEditDailyHours(dailyH);
    setEditAttendedDays(emp.attendedDays !== undefined ? emp.attendedDays : totalD);
    setEditAdvance(emp.advance !== undefined ? emp.advance : 0);
    setEditEarnings(emp.additionalEarnings !== undefined ? emp.additionalEarnings : 0);
    setEditDeductions(emp.deductions !== undefined ? emp.deductions : 0);
  };

  const handleSaveParams = (e) => {
    e.preventDefault();
    if (!editingEmployee) return;
    const tDays = Math.max(1, Number(editTotalDays) || 24);
    const dHours = Math.max(1, Number(editDailyHours) || 8);
    const aDays = Math.min(tDays, Math.max(0, Number(editAttendedDays) !== undefined ? Number(editAttendedDays) : tDays));
    const std = Number(editingEmployee.standardSalary) || 0;
    const totalH = tDays * dHours;
    const hourlyR = totalH > 0 ? Math.round(std / totalH) : 0;
    updateEmployeePayroll(editingEmployee.id, {
      totalDays: tDays,
      dailyHours: dHours,
      totalHours: totalH,
      hourlyRate: hourlyR,
      attendedDays: aDays,
      advance: Number(editAdvance) || 0,
      additionalEarnings: Number(editEarnings) || 0,
      deductions: Number(editDeductions) || 0,
    });
    showToast(`Updated attendance & working hours for ${editingEmployee.name}`);
    setEditingEmployee(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payroll Management"
        subtitle={<>Attendance & Advance Formula: <span className="font-semibold text-slate-700">Remaining Payable = Standard CTC - Attendance LOP (Remaining Days Removed) + Earnings - Deductions - Advance Recovered</span></>}
        guide={hrmsGuides.payroll}
        actions={
          <>
            {/* Department Working Days Schedule Dropdown (Pure Dropdown - No Up/Down Arrows) */}
            <div className="flex items-center gap-2 px-3 h-10 w-full sm:w-auto max-w-full lg:max-w-none min-w-0 lg:min-w-auto bg-white border border-bdr rounded-xl text-[13px] font-medium text-slate-700 shadow-xs">
              <Building2 size={14} className="text-navy shrink-0" />
              <span className="text-muted text-[12px] whitespace-nowrap">Dept Schedule:</span>
              <select
                value={deptFilter}
                onChange={(e) => {
                  setDeptFilter(e.target.value);
                  if (e.target.value !== "All") {
                    const days = getDepartmentDays(departmentWorkingDays, e.target.value);
                    const hours = getDepartmentHours(departmentWorkingHours, e.target.value);
                    showToast(`${e.target.value}: ${days} Working Days • ${hours}h/day (${days * hours}h target)`);
                  }
                }}
                className="min-w-0 lg:min-w-auto flex-1 w-0 sm:flex-initial sm:w-auto font-semibold text-slate-900 bg-transparent outline-none cursor-pointer text-[13px]"
              >
                <option value="All">All Departments (HR Admin Schedule)</option>
                {Object.entries(departmentWorkingDays).map(([dept, days]) => {
                  const hours = getDepartmentHours(departmentWorkingHours, dept);
                  return (
                    <option key={dept} value={dept}>
                      {dept} — {days} Days ({hours}h/d • {days * hours}h)
                    </option>
                  );
                })}
              </select>
            </div>

            <Link
              to="/hrms/hr-admin?tab=working-days"
              className="inline-flex items-center gap-1.5 px-3 h-10 bg-white border border-bdr rounded-xl text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
              title="Configure working days by department in HR Admin"
            >
              <ShieldCheck size={15} className="text-emerald-700" />
              <span>HR Admin Setup</span>
            </Link>

            <select
              value={currentPeriod}
              onChange={(e) => {
                setCurrentPeriod(e.target.value);
                showToast(`Switched cycle to ${e.target.value}`);
              }}
              className="h-10 px-3 bg-white border border-bdr rounded-xl text-[13px] font-medium text-slate-700 shadow-xs focus:outline-none focus:border-navy cursor-pointer"
            >
              <option value="October 2024">October 2024</option>
              <option value="September 2024">September 2024</option>
              <option value="August 2024">August 2024</option>
            </select>

            <button
              type="button"
              onClick={() => setShowGenerateSlipModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-300 text-slate-800 rounded-xl text-[13px] font-semibold shadow-xs hover:bg-slate-50 transition-colors cursor-pointer"
              title="Generate and download employee PDF salary slip"
            >
              <FileText size={15} className="text-emerald-700" />
              <span>Generate Payslip (PDF)</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRunModal(true)}
              className="inline-flex items-center gap-1.5 px-4.5 py-2.5 bg-navy text-white rounded-xl text-[13px] font-medium shadow-xs hover:bg-navy/90 transition-colors cursor-pointer"
            >
              <Receipt size={15} />
              <span>Process Month-End Payroll</span>
            </button>
          </>
        }
      />

      {/* ── Minimal 4-Tab Navigation Bar ── */}
      <div className="flex border-b border-bdr gap-1 bg-white px-3 pt-2.5 rounded-2xl border shadow-xs overflow-x-auto lg:overflow-visible scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("overall")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "overall"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Building2 size={16} />
          <span>Overall Salary</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("department")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "department"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Users size={16} />
          <span>Department-wise</span>
          <span className="px-1.5 py-0.2 text-[10.5px] rounded-md bg-slate-100 text-slate-600 font-medium">
            {departmentPayrolls.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("employee")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "employee"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <User size={16} />
          <span>Employee-wise</span>
          <span className="px-1.5 py-0.2 text-[10.5px] rounded-md bg-slate-100 text-slate-600 font-medium">
            {payrollEmployees.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("own")}
          className={`pb-3 px-3 text-[13.5px] font-semibold border-b-2 transition flex items-center gap-2 cursor-pointer shrink-0 lg:shrink whitespace-nowrap ${
            activeTab === "own"
              ? "border-navy text-navy font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <CreditCard size={16} />
          <span>Own Salary</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: OVERALL SALARY (COMPANY SUMMARY & LIFECYCLE)
         ========================================================================= */}
      {activeTab === "overall" && (
        <div className="flex flex-col gap-6">
          {/* Top KPI Cards - Advanced Salary Matrix */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide">
                Total Standard Budget
              </span>
              <div className="text-[26px] font-extrabold text-slate-900 mt-2 leading-none">
                {formatINR(overallStats.totalStandard)}
              </div>
              <span className="text-[12px] text-muted mt-2">Agreed baseline monthly CTC</span>
            </div>

            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-blue-700 uppercase tracking-wide">
                Total Earned Salary
              </span>
              <div className="text-[26px] font-extrabold text-blue-950 mt-2 leading-none">
                {formatINR(overallStats.totalEarned)}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{
                      width: `${Math.round((overallStats.totalEarned / (overallStats.totalStandard || 1)) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] text-blue-700 font-semibold">
                  {Math.round((overallStats.totalEarned / (overallStats.totalStandard || 1)) * 100)}%
                </span>
              </div>
              {overallStats.totalAttendanceDeduction > 0 && (
                <span className="text-[11px] text-rose-600 block mt-1 font-medium">
                  -{formatINR(overallStats.totalAttendanceDeduction)} absent days removed
                </span>
              )}
            </div>

            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-rose-700 uppercase tracking-wide">
                Advances &amp; Deductions
              </span>
              <div className="text-[26px] font-extrabold text-rose-950 mt-2 leading-none">
                {formatINR(overallStats.totalAdvance + overallStats.totalDeductions)}
              </div>
              <span className="text-[12px] text-muted mt-2">
                Advance: {formatINR(overallStats.totalAdvance)} • Deductions: {formatINR(overallStats.totalDeductions)}
              </span>
            </div>

            <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between">
              <span className="text-[12px] font-semibold text-emerald-700 uppercase tracking-wide">
                Remaining Net Payable
              </span>
              <div className="text-[26px] font-extrabold text-emerald-950 mt-2 leading-none">
                {formatINR(overallStats.totalRemaining)}
              </div>
              <span className="text-[12px] text-emerald-700 mt-2 font-medium">
                {overallStats.paidCount} Paid • {overallStats.totalHeadcount - overallStats.paidCount} Pending
              </span>
            </div>
          </div>

          {/* Month-End Lifecycle Flow Strip */}
          <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-[14.5px] font-bold text-slate-900">
                  Month-End Payroll Lifecycle
                </h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  Current: {workflowStep}
                </span>
              </div>
              <p className="text-[12px] text-muted mt-0.5">
                Standard progression: In Progress → Ready for Review → Approved → Paid
              </p>
            </div>

            {/* Step Indicators */}
            <div className="flex flex-wrap items-center gap-2">
              {WORKFLOW_STAGES.map((step, idx) => {
                const isActive = workflowStep === step.id;
                const isPassed =
                  (workflowStep === "Ready for Review" && step.id === "In Progress") ||
                  (workflowStep === "Approved" && (step.id === "In Progress" || step.id === "Ready for Review")) ||
                  (workflowStep === "Paid" && step.id !== "Paid");

                return (
                  <div key={step.id} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleStageClick(step.id)}
                      className={`px-3 py-1.5 rounded-xl text-[12px] font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                        isActive
                          ? "bg-navy text-white shadow-xs"
                          : isPassed
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {isPassed && <Check size={12} className="text-emerald-700" />}
                      <span>{step.label}</span>
                    </button>
                    {idx < WORKFLOW_STAGES.length - 1 && (
                      <ArrowRight size={13} className="text-slate-300" />
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => setShowGenerateSlipModal(true)}
                className="ml-1 px-3 py-1.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1.5"
                title="Generate employee payslip PDF"
              >
                <Download size={13} className="text-emerald-600" />
                <span>Generate Payslip (PDF)</span>
              </button>

              {workflowStep !== "Paid" ? (
                <button
                  type="button"
                  onClick={handleAdvanceStage}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1"
                >
                  <span>Advance Stage</span>
                  <ChevronRight size={14} />
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleBatchDownloadSlips}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs flex items-center gap-1"
                    title="Download payslips for all staff"
                  >
                    <Download size={13} />
                    <span>Download All Slips</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStageClick("In Progress")}
                    className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[12px] font-medium transition cursor-pointer"
                    title="Reopen cycle for adjustments"
                  >
                    Reopen Cycle
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Two-Column: Salary Structures & Cost Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Salary Band Structures */}
            <div className="lg:col-span-6 bg-white border border-bdr rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-bdr/60 mb-3">
                <div>
                  <h3 className="font-bold text-[15px] text-slate-900">Standard Salary Band Structures</h3>
                  <p className="text-[12px] text-muted">Baseline grade compensation slabs</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddStructureModal(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[12px] font-medium transition cursor-pointer"
                >
                  <Plus size={13} />
                  Add Band
                </button>
              </div>

              <div className="divide-y divide-bdr/40">
                {structures.map((item) => (
                  <div key={item.id} className="py-2.5 flex items-center justify-between text-[13px]">
                    <div>
                      <div className="font-semibold text-slate-900">{item.name}</div>
                      <div className="text-[11px] text-muted">{item.department}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-800">{item.baseMin} - {item.baseMax}</div>
                      <span className="text-[10.5px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                        {item.employees} staff active
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Department Cost Share Progress Bars */}
            <div className="lg:col-span-6 bg-white border border-bdr rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-bdr/60 mb-3">
                <div>
                  <h3 className="font-bold text-[15px] text-slate-900">Department Remaining Payable Share</h3>
                  <p className="text-[12px] text-muted">Net payout allocation per department</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab("department")}
                  className="text-navy text-[12.5px] font-semibold hover:underline cursor-pointer flex items-center gap-1"
                >
                  View Details
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="space-y-3 pt-1">
                {departmentPayrolls.slice(0, 5).map((d) => {
                  const percent = Math.round((d.totalRemaining / (overallStats.totalRemaining || 1)) * 100);
                  return (
                    <div key={d.name} className="space-y-1">
                      <div className="flex justify-between items-center text-[12.5px]">
                        <span className="font-medium text-slate-800">
                          {d.name} <span className="text-muted text-[11px]">({d.headcount} staff)</span>
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatINR(d.totalRemaining)} ({percent}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-navy rounded-full transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DEPARTMENT-WISE PAYROLL
         ========================================================================= */}
      {activeTab === "department" && (
        <div className="flex flex-col gap-4">
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap justify-between items-center gap-3">
            <div>
              <h3 className="font-bold text-[15px] text-slate-900">Department Allocations &amp; Formulas</h3>
              <p className="text-[12px] text-muted">
                Calculated via: Remaining Payable = Earned Salary + Earnings - Deductions - Advance
              </p>
            </div>
            <span className="text-[12px] text-muted font-medium">
              {departmentPayrolls.length} active departments
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {departmentPayrolls.map((dept) => (
              <div
                key={dept.name}
                className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs flex flex-col justify-between transition hover:border-slate-300"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <h4 className="font-bold text-[15px] text-slate-900">{dept.name}</h4>
                      <div className="text-[11.5px] text-muted flex items-center gap-1.5 mt-0.5">
                        <span>{dept.headcount} staff</span>
                        <span>•</span>
                        <span>{getDepartmentDays(departmentWorkingDays, dept.name)}d @ {getDepartmentHours(departmentWorkingHours, dept.name)}h/d</span>
                      </div>
                    </div>
                    <Badge tone={dept.allPaid ? "success" : "warning"}>
                      {dept.allPaid ? "Disbursed" : `${dept.paidCount}/${dept.headcount} Paid`}
                    </Badge>
                  </div>

                  {/* Clean Formula Metrics Breakdown */}
                  <div className="bg-slate-50 border border-bdr/60 rounded-xl p-3 space-y-1.5 text-[12.5px]">
                    <div className="flex justify-between">
                      <span className="text-muted">Standard Salary:</span>
                      <span className="font-medium text-slate-700">{formatINR(dept.totalStandard)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Earned Salary:</span>
                      <span className="font-medium text-blue-800">{formatINR(dept.totalEarned)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Additional Earnings:</span>
                      <span className="font-medium text-emerald-700">+{formatINR(dept.totalEarnings)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Deductions:</span>
                      <span className="font-medium text-rose-700">-{formatINR(dept.totalDeductions)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Salary Advance:</span>
                      <span className="font-medium text-amber-800">-{formatINR(dept.totalAdvance)}</span>
                    </div>

                    <div className="pt-2 border-t border-bdr/60 flex justify-between font-bold text-[13px]">
                      <span className="text-slate-900">Remaining Payable:</span>
                      <span className="text-emerald-700">{formatINR(dept.totalRemaining)}</span>
                    </div>
                  </div>

                  {/* Progress Indicator: Earned vs Standard */}
                  <div className="mt-3 px-1">
                    <div className="flex justify-between text-[11.5px] text-muted mb-1">
                      <span>Earned Progress</span>
                      <span className="font-semibold text-slate-800">{dept.earnedProgress}% of Standard</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-navy rounded-full transition-all duration-300"
                        style={{ width: `${dept.earnedProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between text-[11.5px] text-muted mt-2.5 px-1">
                    <span>Average Payable per staff:</span>
                    <span className="font-semibold text-slate-800">{formatINR(dept.avgSalary)}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-bdr/60 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDeptFilter(dept.name);
                      setActiveTab("employee");
                    }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[12px] font-medium transition cursor-pointer text-center"
                  >
                    View Staff ({dept.headcount})
                  </button>
                  {!dept.allPaid && (
                    <button
                      type="button"
                      onClick={() => {
                        disburseDepartment(dept.name);
                        showToast(`Disbursed payroll for all ${dept.name} personnel`);
                      }}
                      className="px-3 py-1.5 bg-navy text-white hover:bg-navy/90 rounded-xl text-[12px] font-semibold transition cursor-pointer shadow-xs"
                    >
                      Disburse
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: EMPLOYEE-WISE PAYROLL
         ========================================================================= */}
      {activeTab === "employee" && (
        <div className="flex flex-col gap-4">
          {/* Filter Toolbar */}
          <div className="bg-white border border-bdr rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative w-full sm:w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  placeholder="Search name, ID, or designation..."
                  className="w-full h-9.5 pl-9 pr-3.5 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-800 focus:outline-none focus:border-navy"
                />
              </div>

              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="All">All Departments</option>
                <option value="Engineering">Engineering</option>
                <option value="Design">Design</option>
                <option value="Finance">Finance</option>
                <option value="Marketing">Marketing</option>
                <option value="Human Resources">Human Resources</option>
                <option value="Executive">Executive</option>
                <option value="Operations">Operations</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9.5 px-3 bg-off border border-bdr rounded-xl text-[12.5px] text-slate-700 focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value="All">All Statuses</option>
                <option value="Paid">Paid</option>
                <option value="Approved">Approved</option>
                <option value="Ready for Review">Ready for Review</option>
                <option value="In Progress">In Progress</option>
              </select>
            </div>

            <div className="text-[12px] text-muted">
              Showing <span className="font-semibold text-slate-800">{filteredEmployees.length}</span> staff members
            </div>
          </div>

          {/* Master Employee Table with Advanced Calculation Matrix */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] lg:min-w-0 text-left text-[13px]">
                <thead className="bg-slate-50/75 border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                  <tr>
                    <th className="py-3.5 px-4">Employee</th>
                    <th className="py-3.5 px-3">Standard Salary</th>
                    <th className="py-3.5 px-3">Daily &amp; Hourly Rate</th>
                    <th className="py-3.5 px-3">Earned Salary (Attendance)</th>
                    <th className="py-3.5 px-3">Earnings (+)</th>
                    <th className="py-3.5 px-3">Deductions (-)</th>
                    <th className="py-3.5 px-3">Advance (-)</th>
                    <th className="py-3.5 px-3 font-bold text-slate-900">Remaining Payable</th>
                    <th className="py-3.5 px-3">Status &amp; Payment</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted">
                        No employees found matching the filters.
                      </td>
                    </tr>
                  ) : (
                    filteredEmployees.map((p) => {
                      const std = Number(p.standardSalary || 0);
                      const tDays = Number(p.totalDays) || 24;
                      const dHours = Number(p.dailyHours) || getDepartmentHours(departmentWorkingHours, p.department) || 8;
                      const totHours = tDays * dHours;
                      const dayRate = tDays > 0 ? Math.round(std / tDays) : 0;
                      const hourRate = totHours > 0 ? Math.round(std / totHours) : 0;

                      return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        {/* Employee Details */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={p.avatar}
                              alt={p.name}
                              className="w-8 h-8 rounded-full object-cover border border-slate-200"
                            />
                            <div>
                              <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                                <span>{p.name}</span>
                                {p.leaveDays > 0 && (
                                  <span className="text-[10px] font-medium px-1.5 py-0.2 bg-amber-50 text-amber-700 border border-amber-200 rounded-full">
                                    {p.leaveDays}d leave
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted">
                                {p.role} • <span className="font-mono">{p.empId}</span> • {p.department}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Standard Salary (Agreed CTC) */}
                        <td className="py-3.5 px-3 font-medium text-slate-800">
                          <div className="font-bold text-slate-900">{formatINR(p.standardSalary)}</div>
                          <div className="text-[10.5px] text-muted">Agreed base</div>
                        </td>

                        {/* Daily & Hourly Rate (Computed on Employee Standard CTC) */}
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-slate-900 text-[12.5px]">
                            {formatINR(dayRate)}<span className="text-slate-500 font-normal text-[11px]">/day</span>
                          </div>
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                            {formatINR(hourRate)}<span className="text-slate-500 font-normal text-[10.5px]">/hr</span>
                            <span className="text-muted font-normal text-[10px] ml-1">({tDays}d × {dHours}h)</span>
                          </div>
                          <div className="text-[10px] text-muted mt-0.5">
                            1 absent day = -{formatINR(dayRate)} LOP
                          </div>
                        </td>

                        {/* Earned Salary (Pro-rated Attendance) */}
                        <td className="py-3.5 px-3">
                          <div className="font-semibold text-blue-900">{formatINR(p.earnedSalary)}</div>
                          <div className="text-[11px] text-slate-600 font-medium mt-0.5">
                            {p.payableDays}/{p.totalDays} working days
                          </div>
                          {p.absentDays > 0 ? (
                            <div className="text-[10px] text-rose-700 font-medium bg-rose-50 border border-rose-200/80 rounded px-1.5 py-0.5 mt-0.5 inline-block">
                              -{formatINR(p.attendanceDeduction)} ({p.absentDays}d absent removed)
                            </div>
                          ) : (
                            <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                              100% Present
                            </div>
                          )}
                        </td>

                        {/* Earnings (+) */}
                        <td className="py-3.5 px-3 text-emerald-700 font-medium">
                          {p.additionalEarnings > 0 ? `+${formatINR(p.additionalEarnings)}` : "₹0"}
                        </td>

                        {/* Deductions (-) */}
                        <td className="py-3.5 px-3 text-rose-700 font-medium">
                          -{formatINR(p.deductions)}
                        </td>

                        {/* Advance (-) */}
                        <td className="py-3.5 px-3">
                          {p.advance > 0 ? (
                            <div>
                              <span className="text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200 inline-block">
                                -{formatINR(p.advance)}
                              </span>
                              <span className="text-[10px] text-amber-700 block mt-0.5">
                                Advance Deducted
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">₹0</span>
                          )}
                        </td>

                        {/* Remaining Payable Salary */}
                        <td className="py-3.5 px-3 font-bold text-slate-900">
                          <span className="text-emerald-700 text-[14px] block">
                            {formatINR(p.remainingPayable)}
                          </span>
                          <span className="text-[10px] text-muted font-normal block leading-tight">
                            Std {formatINR(p.standardSalary)} {p.attendanceDeduction > 0 ? `- LOP ${formatINR(p.attendanceDeduction)}` : ""} {p.advance > 0 ? `- Adv ${formatINR(p.advance)}` : ""}
                          </span>
                        </td>

                        {/* Payroll Status & Month-End Info */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-0.5">
                            <Badge
                              tone={
                                p.status === "Paid"
                                  ? "success"
                                  : p.status === "Approved"
                                  ? "info"
                                  : p.status === "Ready for Review"
                                  ? "warning"
                                  : "neutral"
                              }
                            >
                              {p.status}
                            </Badge>

                            {/* Month-End Flow: Show Paid Amount & Date when Paid */}
                            {p.status === "Paid" && (
                              <div className="text-[10.5px] text-slate-600 mt-1 leading-tight">
                                <span className="font-semibold text-emerald-700">
                                  Paid: {formatINR(p.paidAmount || p.remainingPayable)}
                                </span>
                                <div className="text-muted text-[10px] flex items-center gap-1 mt-0.5">
                                  <Calendar size={10} />
                                  <span>{p.paymentDate || "Oct 31, 2024"}</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-navy transition cursor-pointer"
                              title="Adjust Advance / Earnings"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedPayslip(p)}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-navy transition cursor-pointer"
                              title="View Payslip"
                            >
                              <Eye size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                downloadPayslipPdf(p);
                                showToast(`Downloading PDF Payslip for ${p.name}`);
                              }}
                              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                              title="Download PDF"
                            >
                              <Download size={15} />
                            </button>
                            {p.status !== "Paid" && (
                              <button
                                type="button"
                                onClick={() => {
                                  markEmployeePaid(p.id, p.remainingPayable);
                                  showToast(`Disbursed & marked ${p.name} as Paid`);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-[11px] font-semibold transition cursor-pointer ml-1"
                              >
                                Pay
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: OWN SALARY (PERSONAL PORTAL & EXACT FORMULA BREAKDOWN)
         ========================================================================= */}
      {activeTab === "own" && (
        <div className="flex flex-col gap-5">
          {/* Minimal Clean Hero Card */}
          <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-navy/5 text-navy border border-navy/15 flex items-center justify-center font-bold text-[18px]">
                {currentUser?.initials || "AG"}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-bold text-slate-900 leading-tight">
                    {ownRecord.name}
                  </h2>
                  <Badge
                    tone={
                      ownRecord.status === "Paid"
                        ? "success"
                        : ownRecord.status === "Approved"
                        ? "info"
                        : "warning"
                    }
                  >
                    {ownRecord.status}
                  </Badge>
                </div>
                <p className="text-[12.5px] text-muted mt-0.5">
                  {ownRecord.role} • {ownRecord.department} • <span className="text-slate-700 font-mono">{ownRecord.empId}</span>
                </p>
                <div className="text-[11.5px] text-muted mt-1.5">
                  Direct deposit: <b className="text-slate-800">{ownRecord.bank}</b>
                  {ownRecord.status === "Paid" && (
                    <span> • Disbursed on <b className="text-emerald-700">{ownRecord.paymentDate || "Oct 31, 2024"}</b></span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between md:justify-end gap-5 pt-3 md:pt-0 border-t md:border-t-0 border-bdr/60">
              <div className="text-left md:text-right">
                <span className="text-[11px] text-muted uppercase tracking-wider block font-medium">
                  {ownRecord.status === "Paid" ? "Net Paid Amount" : "Remaining Net Payable"}
                </span>
                <span className="text-[26px] font-extrabold text-emerald-950 leading-none">
                  {formatINR(ownRecord.status === "Paid" ? (ownRecord.paidAmount || ownRecord.remainingPayable) : ownRecord.remainingPayable)}
                </span>
                {ownRecord.status === "Paid" && (
                  <span className="block text-[11px] text-emerald-700 font-semibold mt-1">
                    Disbursed on {ownRecord.paymentDate || "Oct 31, 2024"}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  downloadPayslipPdf(ownRecord);
                  showToast(`Downloading ${ownRecord.month} Payslip (PDF)`);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-navy text-white rounded-xl text-[13px] font-medium shadow-xs hover:bg-navy/90 transition cursor-pointer shrink-0"
              >
                <Download size={14} />
                <span>Download Payslip PDF</span>
              </button>
            </div>
          </div>

          {/* Perspective Switcher */}
          <div className="bg-white border border-bdr rounded-2xl p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3 text-[12.5px]">
            <div className="flex items-center gap-2 text-slate-600">
              <span>View As Colleague:</span>
              <select
                value={activeOwnUser}
                onChange={(e) => setActiveOwnUser(e.target.value)}
                className="h-8 px-2.5 bg-off border border-bdr rounded-lg font-medium text-slate-900 focus:outline-none focus:border-navy cursor-pointer"
              >
                <option value={currentUser?.name}>{currentUser?.name} (You)</option>
                {payrollEmployees
                  .filter((p) => p.name !== currentUser?.name)
                  .map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.department})
                    </option>
                  ))}
              </select>
            </div>

            <span className="text-muted text-[12px]">
              Cycle: <b className="text-slate-800">{ownRecord.month}</b>
            </span>
          </div>

          {/* Quick Metrics Strip: Standard vs Earned vs Deductions vs Advance */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-muted uppercase font-semibold block">Standard Salary</span>
              <span className="text-[17px] font-bold text-slate-900 block mt-1">{formatINR(ownRecord.standardSalary)}</span>
              <span className="text-[10.5px] text-slate-500">Agreed baseline</span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-blue-700 uppercase font-semibold block">Earned Salary</span>
              <span className="text-[17px] font-bold text-blue-950 block mt-1">{formatINR(ownRecord.earnedSalary)}</span>
              <span className="text-[10.5px] text-blue-700">{ownRecord.payableDays}/{ownRecord.totalDays} days attended</span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-emerald-700 uppercase font-semibold block">Additional Earnings</span>
              <span className="text-[17px] font-bold text-emerald-800 block mt-1">+{formatINR(ownRecord.additionalEarnings)}</span>
              <span className="text-[10.5px] text-muted">Overtime / bonuses</span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-rose-700 uppercase font-semibold block">Deductions</span>
              <span className="text-[17px] font-bold text-rose-800 block mt-1">-{formatINR(ownRecord.deductions)}</span>
              <span className="text-[10.5px] text-muted">PF &amp; taxes</span>
            </div>

            <div className="bg-white border border-bdr rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-amber-800 uppercase font-semibold block">Advance Taken</span>
              <span className="text-[17px] font-bold text-amber-900 block mt-1">-{formatINR(ownRecord.advance)}</span>
              <span className="text-[10.5px] text-muted">Mid-month advance</span>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-3.5 shadow-xs">
              <span className="text-[11px] text-emerald-800 uppercase font-bold block">Remaining Payable</span>
              <span className="text-[17px] font-extrabold text-emerald-950 block mt-1">{formatINR(ownRecord.remainingPayable)}</span>
              <span className="text-[10.5px] text-emerald-700 font-medium">
                {ownRecord.status === "Paid" ? "Disbursed" : "Payable"}
              </span>
            </div>
          </div>

          {/* Salary Progress Indicator */}
          <div className="bg-white border border-bdr rounded-2xl p-4.5 shadow-xs">
            <div className="flex justify-between items-center text-[12.5px] mb-2">
              <span className="font-semibold text-slate-800">
                Salary Progress: Earned vs Standard
              </span>
              <span className="font-bold text-slate-900">
                {formatINR(ownRecord.earnedSalary)} of {formatINR(ownRecord.standardSalary)} ({ownRecord.earnedProgress}%)
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-navy rounded-full transition-all duration-300"
                style={{ width: `${ownRecord.earnedProgress}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] text-muted mt-2">
              <span>Formula: Remaining Payable = Earned Salary + Earnings - Deductions - Advance</span>
              <span className="font-medium text-emerald-700">Net Payable: {formatINR(ownRecord.remainingPayable)}</span>
            </div>
          </div>

          {/* Month-End Payout Card (When status is Paid) */}
          {ownRecord.status === "Paid" && (
            <div className="bg-emerald-50/40 border border-emerald-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div>
                  <div className="text-[14px] font-bold text-emerald-950">
                    Month-End Salary Disbursal Confirmed
                  </div>
                  <div className="text-[12px] text-emerald-800 mt-0.5">
                    Your monthly salary has been successfully settled and transferred to your registered bank account.
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap lg:flex-nowrap items-center gap-x-6 gap-y-2 text-[12.5px]">
                <div>
                  <span className="text-muted block text-[11px]">Paid Amount</span>
                  <span className="font-extrabold text-emerald-950 text-[15px]">
                    {formatINR(ownRecord.paidAmount || ownRecord.remainingPayable)}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Payment Date</span>
                  <span className="font-semibold text-slate-800">
                    {ownRecord.paymentDate || "Oct 31, 2024"}
                  </span>
                </div>
                <div>
                  <span className="text-muted block text-[11px]">Payment Status</span>
                  <span className="font-bold text-emerald-700">Paid</span>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Earnings vs Deductions Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Earnings Section */}
            <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-bdr/60">
                  <h3 className="font-bold text-[15px] text-slate-900">Earnings Components</h3>
                  <span className="font-bold text-slate-900">{formatINR(ownRecord.earnedSalary + ownRecord.additionalEarnings)}</span>
                </div>

                <div className="space-y-2 text-[13px] pt-3">
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Standard Base Salary</span>
                    <span className="font-medium text-slate-900">{formatINR(ownRecord.standardSalary)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">
                      Earned Salary ({ownRecord.payableDays}/{ownRecord.totalDays} Days)
                    </span>
                    <span className="font-semibold text-blue-900">{formatINR(ownRecord.earnedSalary)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Overtime &amp; Incentives</span>
                    <span className="font-semibold text-emerald-700">+{formatINR(ownRecord.additionalEarnings)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-bdr/60 mt-4 flex justify-between font-bold text-[14px]">
                <span className="text-slate-900">Total Earned + Additions</span>
                <span className="text-slate-900">{formatINR(ownRecord.earnedSalary + ownRecord.additionalEarnings)}</span>
              </div>
            </div>

            {/* Deductions & Advance Section */}
            <div className="bg-white border border-bdr rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center pb-2.5 border-b border-bdr/60">
                  <h3 className="font-bold text-[15px] text-slate-900">Deductions &amp; Advance</h3>
                  <span className="font-bold text-rose-700">
                    -{formatINR(ownRecord.deductions + ownRecord.advance)}
                  </span>
                </div>

                <div className="space-y-2 text-[13px] pt-3">
                  {ownRecord.attendanceDeduction > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-50 bg-rose-50/50 px-2 rounded-lg">
                      <span className="text-rose-800 font-medium">
                        Attendance LOP ({ownRecord.absentDays}d absent removed)
                      </span>
                      <span className="font-bold text-rose-700">-{formatINR(ownRecord.attendanceDeduction)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">Provident Fund (PF) &amp; Insurance</span>
                    <span className="font-medium text-slate-900">-{formatINR(Math.round(ownRecord.deductions * 0.6))}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50">
                    <span className="text-slate-500">TDS &amp; Statutory Deductions</span>
                    <span className="font-medium text-rose-700">-{formatINR(Math.round(ownRecord.deductions * 0.4))}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-50 bg-amber-50/50 px-2 rounded-lg">
                    <span className="text-amber-800 font-medium">Salary Advance Recovered</span>
                    <span className="font-bold text-amber-900">-{formatINR(ownRecord.advance)}</span>
                  </div>
                  {ownRecord.leaveDays > 0 && (
                    <div className="text-[11.5px] text-muted px-1">
                      * Includes leave adjustments for {ownRecord.leaveDays} approved leaves.
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-bdr/60 mt-4 flex justify-between font-bold text-[14px]">
                <span className="text-slate-900">Total Deductions + Advance</span>
                <span className="text-rose-700">
                  -{formatINR(ownRecord.deductions + ownRecord.advance)}
                </span>
              </div>
            </div>
          </div>

          {/* Past Months Payslips History Table */}
          <div className="bg-white border border-bdr rounded-2xl shadow-xs overflow-hidden">
            <div className="p-4 pb-2 border-b border-bdr/60 flex flex-wrap lg:flex-nowrap justify-between items-center gap-2 lg:gap-0">
              <div>
                <h3 className="font-bold text-[15px] text-slate-900">Payslip Archive &amp; History</h3>
                <p className="text-[12px] text-muted">6-month salary records with PDF download</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] lg:min-w-0 text-left text-[13px]">
                <thead className="bg-slate-50/75 border-b border-bdr text-[11px] uppercase tracking-wider text-muted font-bold">
                  <tr>
                    <th className="py-3.5 px-5">Month Period</th>
                    <th className="py-3.5 px-5">Slip Ref</th>
                    <th className="py-3.5 px-5">Standard</th>
                    <th className="py-3.5 px-5">Earned</th>
                    <th className="py-3.5 px-5">Advance</th>
                    <th className="py-3.5 px-5 font-bold">Remaining Payable</th>
                    <th className="py-3.5 px-5">Payment Date</th>
                    <th className="py-3.5 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bdr/40">
                  {ownSalaryHistory.map((h, i) => (
                    <tr key={h.slipNo || i} className="hover:bg-slate-50/60 transition">
                      <td className="py-3 px-5 font-medium text-slate-900">{h.month}</td>
                      <td className="py-3 px-5 font-mono text-[12px] text-slate-500">{h.slipNo}</td>
                      <td className="py-3 px-5 text-slate-700">{formatINR(h.standardSalary)}</td>
                      <td className="py-3 px-5 text-blue-900 font-medium">{formatINR(h.earnedSalary)}</td>
                      <td className="py-3 px-5 text-amber-800">-{formatINR(h.advance)}</td>
                      <td className="py-3 px-5 font-bold text-emerald-700">{h.netPay}</td>
                      <td className="py-3 px-5 text-slate-600">{h.payDate}</td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPayslip({
                                ...ownRecord,
                                month: h.month,
                                standardSalary: h.standardSalary,
                                earnedSalary: h.earnedSalary,
                                additionalEarnings: h.additionalEarnings,
                                deductions: h.deductions,
                                advance: h.advance,
                                remainingPayable: h.remainingPayable,
                                paidAmount: h.remainingPayable,
                                paymentDate: h.payDate,
                                status: "Paid",
                              });
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-navy transition cursor-pointer"
                            title="View Slip"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              downloadPayslipPdf({
                                ...ownRecord,
                                month: h.month,
                                standardSalary: h.standardSalary,
                                earnedSalary: h.earnedSalary,
                                additionalEarnings: h.additionalEarnings,
                                deductions: h.deductions,
                                advance: h.advance,
                                status: "Paid",
                                paymentDate: h.payDate,
                                paidAmount: h.remainingPayable,
                              });
                              showToast(`Downloaded PDF Payslip for ${h.month}`);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-emerald-700 transition cursor-pointer"
                            title="Download PDF"
                          >
                            <Download size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: PAYSLIP DETAIL MODAL (ADVANCED FORMULA BREAKDOWN)
         ========================================================================= */}
      {selectedPayslip && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={selectedPayslip.avatar}
                  alt={selectedPayslip.name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <h3 className="font-bold text-[16px] text-slate-900 leading-tight">
                    {selectedPayslip.name}
                  </h3>
                  <p className="text-[12px] text-muted">
                    {selectedPayslip.role} • {selectedPayslip.month || currentPeriod}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Formula Calculation Matrix */}
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Standard Salary (Agreed Base CTC)</span>
                <span className="font-semibold text-slate-800">
                  {formatINR(selectedPayslip.standardSalary)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Month Working Days &amp; Attendance</span>
                <span className="font-semibold text-slate-700">
                  {selectedPayslip.attendedDays !== undefined ? selectedPayslip.attendedDays : 20} Present / {selectedPayslip.totalDays || 24} Days ({selectedPayslip.absentDays || 0}d absent)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Working Schedule &amp; Target Hours</span>
                <span className="font-semibold text-slate-700">
                  {selectedPayslip.dailyHours || 8}h/day • {selectedPayslip.totalHours || ((selectedPayslip.totalDays || 24) * (selectedPayslip.dailyHours || 8))}h target ({formatINR(selectedPayslip.hourlyRate || Math.round(selectedPayslip.standardSalary / ((selectedPayslip.totalDays || 24) * (selectedPayslip.dailyHours || 8))))}/hr)
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Per-Day Salary Rate</span>
                <span className="font-medium text-slate-700">
                  {formatINR(selectedPayslip.perDaySalary || Math.round(selectedPayslip.standardSalary / (selectedPayslip.totalDays || 24)))} / day
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Attendance LOP (Remaining Days Removed) (-)</span>
                <span className="font-semibold text-rose-700">
                  -{formatINR(selectedPayslip.attendanceDeduction || 0)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Earned Base Salary</span>
                <span className="font-semibold text-blue-900">
                  {formatINR(selectedPayslip.earnedSalary)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Additional Earnings (+)</span>
                <span className="font-medium text-emerald-700">
                  +{formatINR(selectedPayslip.additionalEarnings)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Deductions [PF, TDS, Statutory] (-)</span>
                <span className="font-medium text-rose-700">
                  -{formatINR(selectedPayslip.deductions)}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Salary Advance Recovered (-)</span>
                <span className="font-bold text-amber-800">
                  -{formatINR(selectedPayslip.advance)}
                </span>
              </div>

              {/* Formula Badge */}
              <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] text-slate-600">
                <b>Formula:</b> Remaining Payable = Standard CTC - Attendance LOP + Earnings - Deductions - Advance
              </div>

              {/* Net Remaining Payable */}
              <div className="flex justify-between py-2.5 font-bold text-[15px] text-slate-900 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 mt-2">
                <span>Net Remaining Payable</span>
                <span className="text-emerald-800">
                  {formatINR(selectedPayslip.remainingPayable)}
                </span>
              </div>

              {/* Month-End Payment Info if Paid */}
              {selectedPayslip.status === "Paid" && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[12px] text-slate-700 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Payment Status:</span>
                    <span className="font-bold text-emerald-700">Paid</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Paid Amount:</span>
                    <span className="font-semibold text-slate-900">
                      {formatINR(selectedPayslip.paidAmount || selectedPayslip.remainingPayable)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Payment Date:</span>
                    <span className="font-medium text-slate-800">
                      {selectedPayslip.paymentDate || "Oct 31, 2024"}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-2.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  downloadPayslipPdf(selectedPayslip);
                  showToast(`Downloaded PDF Payslip for ${selectedPayslip.name}`);
                  setSelectedPayslip(null);
                }}
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={14} />
                Download PDF Payslip
              </button>
              <button
                type="button"
                onClick={() => setSelectedPayslip(null)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: RUN MONTH-END PAYROLL CONFIRMATION MODAL
         ========================================================================= */}
      {showRunModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <h3 className="font-bold text-[16px] text-slate-900">
                Process Month-End Payroll — {currentPeriod}
              </h3>
              <button
                type="button"
                onClick={() => setShowRunModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {runSuccess ? (
              <div className="py-6 text-center flex flex-col items-center gap-2">
                <CheckCircle2 size={42} className="text-emerald-500" />
                <h4 className="font-bold text-[16px] text-slate-800">Month-End Payroll Disbursed!</h4>
                <p className="text-[13px] text-muted">
                  All {overallStats.totalHeadcount} staff calculations finalized, marked Paid, and stamped with today's date.
                </p>
              </div>
            ) : (
              <>
                <p className="text-[13.5px] text-slate-700 leading-relaxed">
                  Are you sure you want to finalize and disburse month-end payroll for{" "}
                  <b>{overallStats.totalHeadcount} employees</b> for period {currentPeriod}?
                </p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-[12.5px] text-slate-700 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Total Standard Budget:</span>
                    <b>{formatINR(overallStats.totalStandard)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Earned Salary:</span>
                    <b className="text-blue-900">{formatINR(overallStats.totalEarned)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Additional Earnings:</span>
                    <b className="text-emerald-700">+{formatINR(overallStats.totalEarnings)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Deductions:</span>
                    <b className="text-rose-700">-{formatINR(overallStats.totalDeductions)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>Advance Recovered:</span>
                    <b className="text-amber-800">-{formatINR(overallStats.totalAdvance)}</b>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200 flex justify-between font-bold text-[13px]">
                    <span>Total Net Disbursal:</span>
                    <span className="text-emerald-800">{formatINR(overallStats.totalRemaining)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleRunPayroll}
                    className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs"
                  >
                    Confirm &amp; Disburse
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRunModal(false)}
                    className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: QUICK ADJUST ADVANCE / EARNINGS MODAL
         ========================================================================= */}
      {editingEmployee && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <form
            onSubmit={handleSaveParams}
            className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-lg p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div>
                <h3 className="font-bold text-[16px] text-slate-900">Adjust Attendance, Advance &amp; Earnings</h3>
                <p className="text-[12px] text-muted">{editingEmployee.name} ({editingEmployee.empId}) • {editingEmployee.department}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Attendance & Days Input Strip */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200/80 space-y-2.5">
              <div className="flex justify-between items-center text-[12.5px]">
                <span className="text-slate-600 font-medium">Standard Agreed Base CTC:</span>
                <span className="font-bold text-slate-900 text-[13.5px]">{formatINR(editingEmployee.standardSalary)}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1 border-t border-slate-200/60">
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Month Days ({editingEmployee.department})
                  </label>
                  <select
                    value={Number(editTotalDays)}
                    onChange={(e) => {
                      const newT = Number(e.target.value);
                      setEditTotalDays(newT);
                      if (Number(editAttendedDays) > newT) {
                        setEditAttendedDays(newT);
                      }
                    }}
                    className="w-full h-9 px-2.5 bg-white border border-bdr rounded-lg text-[13px] font-medium focus:outline-none focus:border-navy cursor-pointer"
                  >
                    {[20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 31].map((d) => (
                      <option key={d} value={d}>
                        {d} Days {d === getDepartmentDays(departmentWorkingDays, editingEmployee.department) ? "(Dept)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Daily Hours
                  </label>
                  <select
                    value={Number(editDailyHours)}
                    onChange={(e) => setEditDailyHours(Number(e.target.value))}
                    className="w-full h-9 px-2.5 bg-white border border-bdr rounded-lg text-[13px] font-medium focus:outline-none focus:border-navy cursor-pointer"
                  >
                    {[7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0].map((h) => (
                      <option key={h} value={h}>
                        {h.toFixed(1)} hrs {h === getDepartmentHours(departmentWorkingHours, editingEmployee.department) ? "(Dept)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                    Days Attended
                  </label>
                  <select
                    value={Number(editAttendedDays)}
                    onChange={(e) => setEditAttendedDays(Number(e.target.value))}
                    className="w-full h-9 px-2.5 bg-white border border-bdr rounded-lg text-[13px] font-medium focus:outline-none focus:border-navy cursor-pointer"
                  >
                    {Array.from({ length: Number(editTotalDays) + 1 }, (_, i) => i).map((num) => (
                      <option key={num} value={num}>
                        {num} Days {num === Number(editTotalDays) ? "(100%)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Attendance Deduction & Working Hours Calculation */}
              {(() => {
                const curStd = Number(editingEmployee.standardSalary) || 0;
                const curT = Math.max(1, Number(editTotalDays) || 24);
                const curH = Math.max(1, Number(editDailyHours) || 8);
                const curTotH = curT * curH;
                const curHourlyRate = curTotH > 0 ? Math.round(curStd / curTotH) : 0;
                const curA = Math.min(curT, Math.max(0, Number(editAttendedDays) !== undefined ? Number(editAttendedDays) : curT));
                const curAbs = Math.max(0, curT - curA);
                const curRate = curT > 0 ? curStd / curT : 0;
                const curDeduct = Math.round(curRate * curAbs);
                const curEarn = Math.max(0, curStd - curDeduct);

                return (
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11.5px] space-y-1">
                    <div className="flex justify-between text-slate-600">
                      <span>Schedule &amp; Target:</span>
                      <span className="font-mono font-medium">{curT}d × {curH}h/d = {curTotH} hrs target</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Wage Rates:</span>
                      <span className="font-mono font-medium">{formatINR(curRate)}/day • {formatINR(curHourlyRate)}/hr</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Remaining Absent Days:</span>
                      <span className={`font-semibold ${curAbs > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                        {curAbs} days {curAbs > 0 ? "unattended" : "(100% Present)"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-700 font-medium">Attendance LOP (Salary Removed):</span>
                      <span className="font-bold text-rose-700">-{formatINR(curDeduct)}</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-100 font-semibold text-blue-900">
                      <span>Earned Salary (Base):</span>
                      <span>{formatINR(curEarn)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Salary Advance Recovered [₹] (Deducted from final salary)
                </label>
                <input
                  type="number"
                  min="0"
                  value={editAdvance}
                  onChange={(e) => setEditAdvance(e.target.value)}
                  className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="e.g. 5000"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Additional Earnings [₹]
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editEarnings}
                    onChange={(e) => setEditEarnings(e.target.value)}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Monthly Deductions [₹]
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={editDeductions}
                    onChange={(e) => setEditDeductions(e.target.value)}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Live Preview of Full Formula */}
              {(() => {
                const curStd = Number(editingEmployee.standardSalary) || 0;
                const curT = Math.max(1, Number(editTotalDays) || 24);
                const curA = Math.min(curT, Math.max(0, Number(editAttendedDays) !== undefined ? Number(editAttendedDays) : curT));
                const curAbs = Math.max(0, curT - curA);
                const curRate = curT > 0 ? curStd / curT : 0;
                const curDeduct = Math.round(curRate * curAbs);
                const curEarn = Math.max(0, curStd - curDeduct);
                const curNet = Math.max(0, curEarn + (Number(editEarnings) || 0) - (Number(editDeductions) || 0) - (Number(editAdvance) || 0));

                return (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-[12.5px] space-y-1">
                    <div className="flex justify-between items-center font-bold">
                      <span className="text-emerald-950">Net Remaining Payable:</span>
                      <span className="text-emerald-800 text-[15px] font-extrabold">{formatINR(curNet)}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 pt-1 border-t border-emerald-200/60 leading-tight">
                      Std ({formatINR(curStd)}) - Attendance LOP ({formatINR(curDeduct)}) + Earnings ({formatINR(editEarnings)}) - Deductions ({formatINR(editDeductions)}) - Advance ({formatINR(editAdvance)})
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs"
              >
                Apply Changes
              </button>
              <button
                type="button"
                onClick={() => setEditingEmployee(null)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 4: ADD SALARY STRUCTURE MODAL
         ========================================================================= */}
      {showAddStructureModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <form
            onSubmit={handleAddStructureSubmit}
            className="bg-white rounded-2xl border border-bdr shadow-xl w-full max-w-md p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <h3 className="font-bold text-[16px] text-slate-900">Add Salary Band Structure</h3>
              <button
                type="button"
                onClick={() => setShowAddStructureModal(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Structure / Band Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering — L5 (Staff Dev)"
                  value={newStructure.name}
                  onChange={(e) => setNewStructure({ ...newStructure, name: e.target.value })}
                  className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Department
                  </label>
                  <select
                    value={newStructure.department}
                    onChange={(e) => setNewStructure({ ...newStructure, department: e.target.value })}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[12.5px] focus:outline-none focus:border-navy cursor-pointer"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Design">Design</option>
                    <option value="Finance">Finance</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Human Resources">Human Resources</option>
                    <option value="Executive">Executive</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                    Staff Headcount
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 15"
                    value={newStructure.employees}
                    onChange={(e) => setNewStructure({ ...newStructure, employees: e.target.value })}
                    className="w-full h-10 px-3 bg-off border border-bdr rounded-xl text-[13px] focus:outline-none focus:border-navy"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                type="submit"
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs"
              >
                Save Structure
              </button>
              <button
                type="button"
                onClick={() => setShowAddStructureModal(false)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 5: LIFECYCLE TRANSITION WITH REAL-LIFE SCENARIO
         ========================================================================= */}
      {showLifecycleModal && targetStage && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-2xl w-full max-w-lg p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Payroll Lifecycle Transition
                </span>
                <h3 className="font-bold text-[17px] text-slate-900 mt-0.5">
                  {STAGE_SCENARIOS[targetStage]?.title || `Move to ${targetStage}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLifecycleModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scenario Narrative Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <div className="text-[12.5px] font-bold text-slate-800 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span>Real-Life Business Scenario:</span>
              </div>
              <p className="text-[13px] text-slate-600 leading-relaxed">
                {STAGE_SCENARIOS[targetStage]?.description}
              </p>
            </div>

            {/* Operational Checkpoints */}
            <div className="space-y-1.5">
              <span className="text-[11.5px] font-bold text-slate-700 uppercase tracking-wide">
                Key Operations in this Stage:
              </span>
              <ul className="space-y-1 text-[12.5px] text-slate-700">
                {STAGE_SCENARIOS[targetStage]?.bullets?.map((b, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Financial Overview Summary */}
            <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between text-[12px]">
              <div>
                <div className="text-slate-400 text-[11px]">Pay Period</div>
                <div className="font-bold text-white">{currentPeriod}</div>
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Headcount</div>
                <div className="font-bold text-white">{overallStats.totalHeadcount} Staff</div>
              </div>
              <div>
                <div className="text-slate-400 text-[11px]">Total Net Payout</div>
                <div className="font-extrabold text-emerald-400 text-[14px]">
                  {formatINR(overallStats.totalRemaining)}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 mt-1">
              <button
                type="button"
                onClick={() => executeStageTransition(targetStage)}
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>{STAGE_SCENARIOS[targetStage]?.actionLabel || `Confirm ${targetStage}`}</span>
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                onClick={() => setShowLifecycleModal(false)}
                className="px-4 bg-off border border-bdr text-slate-700 hover:bg-slate-100 rounded-xl py-2.5 font-medium text-[13px] transition cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 6: GENERATE PAYROLL SLIP (PDF)
         ========================================================================= */}
      {showGenerateSlipModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="bg-white rounded-2xl border border-bdr shadow-2xl w-full max-w-xl p-4 sm:p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-bdr/60 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Download size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-[16px] text-slate-900">
                    Generate Payroll Slip (PDF)
                  </h3>
                  <p className="text-[12px] text-muted">
                    Certified salary slips adhering to company compensation formula
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGenerateSlipModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Employee Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[12px] font-semibold text-slate-700">
                  Select Employee:
                </label>
                <span className="text-[11px] text-slate-500">
                  {computedEmployeePayrolls.length} total enrolled
                </span>
              </div>

              {/* Selected Employee Card Trigger */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setSlipPickerOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between p-2.5 bg-slate-50/90 hover:bg-slate-100/80 border border-slate-300 rounded-xl transition cursor-pointer text-left focus:outline-none focus:border-navy"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <img
                      src={slipSelectedEmp?.avatar}
                      alt={slipSelectedEmp?.name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="font-bold text-[13px] text-slate-900 truncate">
                        {slipSelectedEmp?.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {slipSelectedEmp?.role} • {slipSelectedEmp?.department}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11.5px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200">
                      {formatINR(slipSelectedEmp?.remainingPayable)}
                    </span>
                    <div className="flex items-center gap-1 text-[11.5px] text-navy font-semibold bg-white border border-slate-200 rounded-md px-2 py-1 shadow-2xs hover:bg-slate-50">
                      <span>{slipPickerOpen ? "Close" : "Switch"}</span>
                      <ChevronDown
                        size={13}
                        className={`transition-transform duration-150 ${
                          slipPickerOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {/* Searchable Picker Dropdown Menu */}
                {slipPickerOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setSlipPickerOpen(false)}
                    />
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
                      {/* Search Bar */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                        <Search size={13} className="text-slate-400 shrink-0 ml-1" />
                        <input
                          type="text"
                          value={slipSearchQuery}
                          onChange={(e) => setSlipSearchQuery(e.target.value)}
                          placeholder="Search by name, role, department..."
                          className="w-full bg-transparent border-none text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-none"
                          autoFocus
                        />
                        {slipSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setSlipSearchQuery("")}
                            className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>

                      {/* Employee List */}
                      <div className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {filteredPickerEmployees.length === 0 ? (
                          <div className="p-4 text-center text-[12px] text-slate-400">
                            No employee matches &quot;{slipSearchQuery}&quot;
                          </div>
                        ) : (
                          filteredPickerEmployees.map((emp) => {
                            const isSelected = emp.id === slipSelectedEmp?.id;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setSlipSelectedEmpId(emp.id);
                                  setSlipPickerOpen(false);
                                  setSlipSearchQuery("");
                                }}
                                className={`w-full flex items-center justify-between p-2.5 text-left transition cursor-pointer ${
                                  isSelected
                                    ? "bg-navy/5 font-semibold"
                                    : "hover:bg-slate-50 text-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                  <img
                                    src={emp.avatar}
                                    alt={emp.name}
                                    className="w-7 h-7 rounded-full object-cover border border-slate-200 shrink-0"
                                  />
                                  <div className="min-w-0 truncate">
                                    <div className="text-[12.5px] font-medium text-slate-900 truncate">
                                      {emp.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 truncate">
                                      {emp.role} • {emp.department}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[11.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                    {formatINR(emp.remainingPayable)}
                                  </span>
                                  {isSelected && (
                                    <Check size={14} className="text-navy shrink-0" />
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Payslip Live Preview Card */}
            {slipSelectedEmp && (
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
                  <div className="flex items-center gap-3">
                    <img
                      src={slipSelectedEmp.avatar}
                      alt={slipSelectedEmp.name}
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <h4 className="font-bold text-[14.5px] text-slate-900">
                        {slipSelectedEmp.name}
                      </h4>
                      <p className="text-[11.5px] text-muted">
                        {slipSelectedEmp.role} • {slipSelectedEmp.department}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                      slipSelectedEmp.status === "Paid"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {slipSelectedEmp.status}
                    </span>
                    <div className="text-[11px] text-muted mt-1">
                      {currentPeriod}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-slate-500 text-[11px]">Agreed CTC (Standard)</div>
                    <div className="font-bold text-slate-800">{formatINR(slipSelectedEmp.standardSalary)}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-slate-500 text-[11px]">Earned Base Salary</div>
                    <div className="font-bold text-blue-900">{formatINR(slipSelectedEmp.earnedSalary)}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-slate-500 text-[11px]">Attendance LOP (Removed)</div>
                    <div className="font-bold text-rose-700">-{formatINR(slipSelectedEmp.attendanceDeduction || 0)}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-slate-500 text-[11px]">Additional Earnings (+)</div>
                    <div className="font-bold text-emerald-700">+{formatINR(slipSelectedEmp.additionalEarnings)}</div>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200/80">
                    <div className="text-slate-500 text-[11px]">Advance Recovered (-)</div>
                    <div className="font-bold text-amber-800">
                      -{formatINR(slipSelectedEmp.advance || 0)}
                    </div>
                  </div>
                </div>

                {/* Net Remaining Payable Bar */}
                <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[13px]">
                  <span className="font-semibold text-emerald-900">Net Take-Home Payable</span>
                  <span className="text-[16px] font-extrabold text-emerald-800">
                    {formatINR(slipSelectedEmp.remainingPayable)}
                  </span>
                </div>

                <div className="text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-1">
                  <span>Bank: {slipSelectedEmp.bank || "Direct Deposit"}</span>
                  <span>Attendance: {slipSelectedEmp.attendedDays !== undefined ? slipSelectedEmp.attendedDays : 20} / {slipSelectedEmp.totalDays || 24} Days ({slipSelectedEmp.absentDays || 0}d absent) • {slipSelectedEmp.dailyHours || 8}h/day ({slipSelectedEmp.totalHours || ((slipSelectedEmp.totalDays || 24) * (slipSelectedEmp.dailyHours || 8))}h target)</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (slipSelectedEmp) {
                    downloadPayslipPdf(slipSelectedEmp);
                    showToast(`Downloaded PDF Payslip for ${slipSelectedEmp.name}`);
                  }
                }}
                className="flex-1 bg-navy hover:bg-navy/90 text-white rounded-xl py-2.5 font-semibold text-[13px] transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Download size={15} />
                <span>Download PDF Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (slipSelectedEmp) {
                    printPayslip(slipSelectedEmp);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-4 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-xl py-2.5 font-semibold text-[13px] transition cursor-pointer"
              >
                <Printer size={15} />
                <span>Print / Save PDF</span>
              </button>

              <button
                type="button"
                onClick={handleBatchDownloadSlips}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[12.5px] font-medium transition cursor-pointer"
              >
                <Download size={13} className="text-emerald-700" />
                <span>Download All {computedEmployeePayrolls.length} Payslips (Batch)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
