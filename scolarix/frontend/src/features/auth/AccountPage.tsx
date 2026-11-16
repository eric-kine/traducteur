import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { changePasswordSchema, ROLE_LABELS, type ChangePasswordInput } from '@scolarix/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/common/FormField';
import { api } from '@/lib/api';
import { applyApiErrors } from '@/lib/form-errors';
import { useAuth } from '@/stores/auth.store';

export function AccountPage() {
  const { user, clear } = useAuth();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  const onSubmit = async (data: ChangePasswordInput) => {
    try {
      await api('/auth/change-password', { method: 'POST', body: data });
      toast.success('Mot de passe modifié. Veuillez vous reconnecter.');
      clear();
      navigate('/login', { replace: true });
    } catch (err) {
      applyApiErrors(err, setError);
    }
  };

  if (!user) return null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Mon compte</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Informations</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="text-muted-foreground">Nom :</span> {user.firstName} {user.lastName}</p>
          <p><span className="text-muted-foreground">Email :</span> {user.email}</p>
          <p><span className="text-muted-foreground">Rôle :</span> {ROLE_LABELS[user.role]}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Changer mon mot de passe</CardTitle>
          <CardDescription>Au moins 8 caractères, dont une lettre et un chiffre.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField id="currentPassword" label="Mot de passe actuel" error={errors.currentPassword?.message}>
              <Input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} />
            </FormField>
            <FormField id="newPassword" label="Nouveau mot de passe" error={errors.newPassword?.message}>
              <Input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} />
            </FormField>
            <Button type="submit" disabled={isSubmitting}>Enregistrer</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
