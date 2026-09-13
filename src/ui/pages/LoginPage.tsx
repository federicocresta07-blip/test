import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from '../components/ui/Button.tsx';
import { login, type Session } from '../services/index.ts';

/**
 * LA ENTRADA.
 *
 * Usuario y contraseña, nada más. No hay registro, no hay "olvidé mi
 * contraseña" y no hay "recordarme": son cuatro personas conocidas con
 * contraseñas que les dieron, y cada cosa de esas sería un sistema entero.
 *
 * QUE NO HACE ESTA PANTALLA. No dice si un usuario existe. El servidor
 * responde el mismo error para un nombre que no está y para una contraseña
 * equivocada, y acá se muestra tal cual: distinguirlos le regalaría a
 * cualquiera la lista de quiénes juegan.
 */
export function LoginPage({
  onEntered,
}: {
  readonly onEntered: (session: Session) => void;
}): ReactNode {
  const [usuario, setUsuario] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);

    const outcome = await login(usuario.trim(), contrasena);
    if (outcome.ok) {
      onEntered(outcome.session);
      return;
    }

    // La contraseña se limpia y el usuario NO: lo más probable es que el error
    // sea un dedazo en la contraseña, y volver a tipear el nombre cada vez
    // molesta sin proteger nada.
    setContrasena('');
    setError(outcome.error);
    setPending(false);
  }

  return (
    <div className="login">
      <form className="login__box" onSubmit={submit}>
        <div className="login__head">
          <p className="login__kicker">Apertura 1998</p>
          <h1 className="login__title">Argentina Manager</h1>
        </div>

        <label className="login__field" htmlFor="login-usuario">
          <span className="login__label">Usuario</span>
          <input
            id="login-usuario"
            className="login__input"
            name="usuario"
            value={usuario}
            onChange={(event) => setUsuario(event.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
          />
        </label>

        <label className="login__field" htmlFor="login-contrasena">
          <span className="login__label">Contraseña</span>
          <input
            id="login-contrasena"
            className="login__input"
            name="contrasena"
            type="password"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error !== null ? (
          <p className="login__error" role="alert">
            {error}
          </p>
        ) : null}

        <Button variant="primary" type="submit" block disabled={pending}>
          {pending ? 'Entrando…' : 'Entrar'}
        </Button>

        <p className="login__note">
          Cada uno dirige su propio club y su propia carrera. La partida se guarda en el
          servidor, así que se puede seguir desde otra máquina.
        </p>
      </form>
    </div>
  );
}
