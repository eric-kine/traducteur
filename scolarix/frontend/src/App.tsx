import { useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuth } from '@/stores/auth.store';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { NotFoundPage } from '@/routes/ErrorPages';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { AccountPage } from '@/features/auth/AccountPage';
import { HomePage } from '@/features/home/HomePage';
import { UsersPage } from '@/features/users/UsersPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { SchoolDetailPage } from '@/features/schools/SchoolDetailPage';
import { LevelCurriculumPage } from '@/features/teaching-units/LevelCurriculumPage';
import { StudentsPage } from '@/features/students/StudentsPage';
import { StudentDetailPage } from '@/features/students/StudentDetailPage';
import { TeachersPage } from '@/features/teachers/TeachersPage';
import { TeacherDetailPage } from '@/features/teachers/TeacherDetailPage';
import { GradeSheetPage } from '@/features/grades/GradeSheetPage';
import { LevelResultsPage } from '@/features/grades/LevelResultsPage';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default function App() {
  const init = useAuth((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="account" element={<AccountPage />} />
              <Route element={<ProtectedRoute roles={['ADMIN', 'SCOLARITE']} />}>
                <Route path="admin" element={<AdminPage />} />
                <Route path="admin/schools/:id" element={<SchoolDetailPage />} />
                <Route path="admin/levels/:id" element={<LevelCurriculumPage />} />
                <Route path="admin/levels/:id/results" element={<LevelResultsPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="students/:id" element={<StudentDetailPage />} />
                <Route path="teachers" element={<TeachersPage />} />
                <Route path="teachers/:id" element={<TeacherDetailPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['ADMIN', 'SCOLARITE', 'ENSEIGNANT']} />}>
                <Route path="grades/:unitId" element={<GradeSheetPage />} />
              </Route>
              <Route element={<ProtectedRoute roles={['ADMIN']} />}>
                <Route path="users" element={<UsersPage />} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
