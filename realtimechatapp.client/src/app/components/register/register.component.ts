import { Component } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { Router, RouterLink } from '@angular/router';
import { NgForm, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.css']
})
export class RegisterComponent {
  registerData = {
    fullname: '',
    email: '',
    userName: '',
    password: ''
  };
  selectedFile: File | null = null;
  errorMessage: string | null = null;

  // 1. ДОДАНО ЦЕЙ РЯДОК
  public showPassword = false;

  constructor(private authService: AuthService, private router: Router) { }

  onFileSelected(event: any): void {
    this.selectedFile = event.target.files[0] as File;
  }

  onSubmit(form: NgForm): void {
    if (form.invalid) {
      return;
    }
    this.errorMessage = null;

    const formData = new FormData();
    formData.append('fullname', this.registerData.fullname);
    formData.append('email', this.registerData.email);
    formData.append('userName', this.registerData.userName);
    formData.append('password', this.registerData.password);

    if (this.selectedFile) {
      formData.append('profileImage', this.selectedFile, this.selectedFile.name);
    }

    this.authService.register(formData).subscribe({
      next: () => {
        alert('Реєстрація успішна! Тепер ви можете увійти.');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.errorMessage = err.error || 'Помилка реєстрації. Спробуйте ще раз.';
        console.error(err);
      }
    });
  }
}
