import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';               
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';  
import {
  FormControl,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,           
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,        
    ReactiveFormsModule
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  emailFormControl = new FormControl('', [
    Validators.required,
    Validators.email
  ]);
  passwordFormControl = new FormControl('', [
    Validators.required,
    Validators.minLength(6)
  ]);

  loginForm = new FormGroup({
    email: this.emailFormControl,
    password: this.passwordFormControl
  });

  onSubmit() {
    if (this.loginForm.valid) {
      const { email, password } = this.loginForm.value;
      console.log('Login with', email, password);
    }
  }

  get email() {
    return this.emailFormControl;
  }
  get password() {
    return this.passwordFormControl;
  }
}
