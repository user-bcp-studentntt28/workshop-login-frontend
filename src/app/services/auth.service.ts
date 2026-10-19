import { Injectable } from '@angular/core';
import axios from 'axios';
import { environment } from '../../environments/environment';
import {
  AuthenticatedUser,
  isAuthenticatedUser,
  isRecord,
  LoginRequest,
  LoginResponse
} from '../models/auth.models';
import { SessionService } from './session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  constructor(private readonly sessionService: SessionService) {}

  async authenticate(request: LoginRequest): Promise<void> {
    const response = await axios.post<unknown>(
      `${environment.authApiUrl}/auth/login`,
      request,
      { timeout: environment.loginTimeoutMs }
    );
    const loginResponse = parseLoginResponse(response.data);
    this.sessionService.saveSession(loginResponse.token, loginResponse.user);
  }
}

export class InvalidLoginResponseError extends Error {
  constructor() {
    super('The login response does not contain a valid token and user');
    this.name = 'InvalidLoginResponseError';
  }
}

function parseLoginResponse(value: unknown): LoginResponse {
  if (!isRecord(value) || typeof value['token'] !== 'string' || !value['token']) {
    throw new InvalidLoginResponseError();
  }

  const user = value['user'];
  if (!isAuthenticatedUser(user)) {
    throw new InvalidLoginResponseError();
  }

  return { token: value['token'], user };
}
