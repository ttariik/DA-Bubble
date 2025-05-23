import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '../shared/header/header.component';
import { FooterComponent } from '../shared/footer/footer.component';

@Component({
  selector: 'app-impressum',
  standalone: true,
  imports: [CommonModule, HeaderComponent, FooterComponent],
  templateUrl: './impressum.component.html',
  styleUrls: ['./impressum.component.scss']
})
export class ImpressumComponent {
  private router = inject(Router);

  navigateBack(): void {
    this.router.navigate(['/login']);
  }
}
