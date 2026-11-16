import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { z } from 'zod';
import { createUserSchema, ROLE_LABELS, ROLES, type UserDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/select';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useCreateUser, useUpdateUser } from './users.api';

// En modification, le mot de passe n'est pas demandé (il se réinitialise à part).
const editSchema = createUserSchema.omit({ password: true, schoolId: true });
type FormValues = z.infer<typeof createUserSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Utilisateur à modifier ; absent = création */
  user?: UserDto | null;
}

export function UserFormDialog({ open, onOpenChange, user }: Props) {
  const isEdit = !!user;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver((isEdit ? editSchema : createUserSchema) as typeof createUserSchema),
  });

  useEffect(() => {
    if (open) {
      reset(
        user
          ? { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role }
          : { email: '', password: '', firstName: '', lastName: '', role: 'ENSEIGNANT' },
      );
    }
  }, [open, user, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      if (user) {
        const { password: _p, schoolId: _s, ...changes } = values;
        await updateUser.mutateAsync({ id: user.id, ...changes });
        toast.success('Utilisateur modifié');
      } else {
        await createUser.mutateAsync(values);
        toast.success('Utilisateur créé');
      }
      onOpenChange(false);
    } catch (err) {
      applyApiErrors(err, setError);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'utilisateur" : 'Nouvel utilisateur'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Les changements de rôle prennent effet immédiatement.' : "L'utilisateur pourra se connecter avec cet email et ce mot de passe."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="firstName" label="Prénom" error={errors.firstName?.message}>
              <Input id="firstName" {...register('firstName')} />
            </FormField>
            <FormField id="lastName" label="Nom" error={errors.lastName?.message}>
              <Input id="lastName" {...register('lastName')} />
            </FormField>
          </div>
          <FormField id="email" label="Email" error={errors.email?.message}>
            <Input id="email" type="email" {...register('email')} />
          </FormField>
          {!isEdit && (
            <FormField id="password" label="Mot de passe initial" error={errors.password?.message}>
              <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            </FormField>
          )}
          <FormField id="role" label="Rôle" error={errors.role?.message}>
            <NativeSelect id="role" {...register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? 'Enregistrer' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
