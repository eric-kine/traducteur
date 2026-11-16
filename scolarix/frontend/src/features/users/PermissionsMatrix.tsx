import { Check, Minus } from 'lucide-react';
import { PERMISSIONS, ROLE_LABELS, ROLES } from '@scolarix/shared';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/** Matrice des permissions par rôle (référence partagée avec le serveur et le README). */
export function PermissionsMatrix() {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Domaine</TableHead>
            <TableHead>Action</TableHead>
            {ROLES.map((r) => <TableHead key={r} className="text-center">{ROLE_LABELS[r]}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {PERMISSIONS.map((p, i) => (
            <TableRow key={i}>
              <TableCell className="font-medium">{p.area}</TableCell>
              <TableCell className="text-sm">{p.action}{p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}</TableCell>
              {ROLES.map((r) => (
                <TableCell key={r} className="text-center">
                  {p.roles[r] === 'all' ? <Check className="mx-auto h-4 w-4 text-emerald-600" aria-label="autorisé" />
                    : p.roles[r] === 'scoped' ? <span className="text-xs font-semibold text-amber-700" title={p.note}>limité</span>
                    : <Minus className="mx-auto h-4 w-4 text-muted-foreground/50" aria-label="interdit" />}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
