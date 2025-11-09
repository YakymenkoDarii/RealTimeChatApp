import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { jwtDecode } from 'jwt-decode';

interface LoginDto {
  email: string;
  password: string;
}

interface AuthResponse {
  token: string;
}

// Інтерфейс для даних усередині токена
interface JwtPayload {
  nameid: string;      // ID користувача
  unique_name: string; // UserName
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/api/account`;
  private loggedIn = new BehaviorSubject<boolean>(this.hasToken());

  // Ці властивості тепер будуть заповнюватися автоматично
  public currentUserName: string | null = null;
  public currentUserId: string | null = null;

  constructor(private http: HttpClient, private router: Router) {
    // Завантажуємо дані користувача, якщо токен вже існує
    this.decodeToken(this.getToken());
  }

  login(loginDto: LoginDto): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, loginDto).pipe(
      tap(response => {
        this.saveToken(response.token); // Це автоматично викличе decodeToken
        this.loggedIn.next(true);
        this.router.navigate(['/chat']);
      })
    );
  }

  register(formData: FormData): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, formData).pipe(
      tap(() => {
        this.router.navigate(['/login']);
      })
    );
  }

  logout(): void {
    // ❗️ Використовуємо sessionStorage, щоб вкладки браузера не конфліктували
    sessionStorage.removeItem('authToken');
    this.currentUserName = null;
    this.currentUserId = null;
    this.loggedIn.next(false);
    this.router.navigate(['/login']);
  }

  private saveToken(token: string): void {
    // ❗️ Використовуємо sessionStorage
    sessionStorage.setItem('authToken', token);
    // ❗️ Декодуємо токен одразу після збереження
    this.decodeToken(token);
  }

  getToken(): string | null {
    // ❗️ Використовуємо sessionStorage
    return sessionStorage.getItem('authToken');
  }

  private hasToken(): boolean {
    return !!this.getToken();
  }

  isLoggedIn(): Observable<boolean> {
    return this.loggedIn.asObservable();
  }

  getLoggedInStatus(): boolean {
    return this.loggedIn.getValue();
  }

  // --- ❗️ Новий реалізований метод ---
  /**
   * Декодує JWT токен і зберігає ім'я та ID користувача
   */
  private decodeToken(token: string | null): void {
    if (token) {
      try {
        const decodedToken = jwtDecode<JwtPayload>(token);
        this.currentUserId = decodedToken.nameid;
        this.currentUserName = decodedToken.unique_name;
      } catch (error) {
        console.error("Не вдалося розшифрувати токен", error);
        // Видаляємо недійсний токен
        sessionStorage.removeItem('authToken');
      }
    }
  }
}
