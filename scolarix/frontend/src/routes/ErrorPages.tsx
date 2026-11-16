import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

function ErrorPage({ code, title, text }: { code: string; title: string; text: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <p className="text-5xl font-bold text-primary">{code}</p>
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground">{text}</p>
      <Button asChild variant="outline">
        <Link to="/">Retour à l'accueil</Link>
      </Button>
    </div>
  );
}

export const ForbiddenPage = () => (
  <ErrorPage code="403" title="Accès refusé" text="Votre rôle ne permet pas d'accéder à cette page." />
);
export const NotFoundPage = () => (
  <ErrorPage code="404" title="Page introuvable" text="Cette page n'existe pas ou a été déplacée." />
);
