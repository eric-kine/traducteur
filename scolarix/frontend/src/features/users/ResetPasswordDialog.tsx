import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { resetPasswordSchema, type ResetPasswordInput, type UserDto } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';
import { applyApiErrors } from '@/lib/form-errors';
import { useResetPassword } from './users.api';

export function ResetPasswordDialog({ user, onClose }: { user: UserDto | null; onClose: () => void }) {
  const reset = useResetPassword();
  const form = useForm<ResetPasswordInput>({ resolver: zodResolver(resetPasswordSchema) });
  useEffect(() => form.reset({ password: '' }), [user, form]);

  const onSubmit = async ({ password }: ResetPasswordInput) => {
    try {
      await reset.mutateAsync({ id: user!.id, password });
      toast.success('Mot de passe réinitialisé. Communiquez-le à la personne.');
      onClose();
    } catch (err) {
      applyApiErrors(err, form.setError);
    }
  };

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
          <DialogDescription>
            {user?.firstName} {user?.lastName} sera déconnecté(e) de tous ses appareils.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField id="new-password" label="Nouveau mot de passe" error={form.formState.errors.password?.message}>
            <Input id="new-password" type="password" autoComplete="new-password" {...form.register('password')} />
          </FormField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>Réinitialiser</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
