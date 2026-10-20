import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { LoginPreferences } from '../models/auth.models';
import { AuthService, InvalidLoginResponseError } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { toUserFacingError } from '../utils/api-error';

const DEFAULT_PREFERENCES: LoginPreferences = {
  theme: 'light',
  showTips: true,
  compact: false
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  busy = false;
  message = '';
  preferences: LoginPreferences;

  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly router: Router
  ) {
    this.preferences = this.sessionService.loadPreferences(DEFAULT_PREFERENCES);
  }

  async login(): Promise<void> {
    this.message = '';
    if (!this.username.trim()) {
      this.message = 'Ingrese un usuario.';
      return;
    }
    if (!this.password.trim()) {
      this.message = 'Ingrese una contraseña.';
      return;
    }

    this.busy = true;
    try {
      await this.authService.authenticate({
        username: this.username,
        password: this.password,
        client: environment.authClient
      });
      this.sessionService.savePreferences(this.preferences);
      await this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      this.message = error instanceof InvalidLoginResponseError
        ? 'El backend respondió sin una sesión válida.'
        : toUserFacingError(error, 'login');
    } finally {
      this.busy = false;
    }
  }
}
