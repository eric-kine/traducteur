import { cn } from '@/lib/utils';
import { useStudentPhoto } from './students.api';

/** Photo de l'étudiant, ou ses initiales s'il n'en a pas. */
export function StudentAvatar({
  student, size = 'md', version = 0,
}: { student: { id: string; firstName: string; lastName: string; hasPhoto: boolean }; size?: 'md' | 'xl'; version?: number }) {
  const { data: url } = useStudentPhoto(student.id, student.hasPhoto, version);
  const cls = size === 'xl' ? 'h-32 w-32 text-3xl' : 'h-9 w-9 text-xs';
  return url ? (
    <img src={url} alt={`Photo de ${student.firstName} ${student.lastName}`} className={cn('rounded-full object-cover', cls)} />
  ) : (
    <div aria-hidden className={cn('flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary', cls)}>
      {student.firstName[0]}{student.lastName[0]}
    </div>
  );
}
