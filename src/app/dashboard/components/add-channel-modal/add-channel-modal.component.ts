import {
  Component,
  ElementRef,
  EventEmitter,
  inject,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { trigger, transition, style, animate } from '@angular/animations';
import { collection, addDoc, Firestore } from 'firebase/firestore';
import { FirestoreService } from '../../../services/firestore.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-add-channel-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './add-channel-modal.component.html',
  styleUrls: ['./add-channel-modal.component.scss'],
  animations: [
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 1 }),
        animate('0ms', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('50ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('scaleInOut', [
      transition(':enter', [
        style({ opacity: 1, transform: 'translateY(0) scale(1)' }),
        animate('0ms', style({ opacity: 1, transform: 'translateY(0) scale(1)' })),
      ]),
      transition(':leave', [
        animate(
          '50ms ease-in',
          style({ opacity: 0, transform: 'translateY(20px) scale(0.95)' })
        ),
      ]),
    ]),
  ],
})
export class AddChannelModalComponent implements OnChanges {
  @Input() isVisible = false;
  activUserId: string = '';
  @Output() close = new EventEmitter<void>();
  @Output() channelCreated = new EventEmitter<{
    name: string;
    description: string;
  }>();
  @ViewChild('nameInput') nameInput!: ElementRef;
 private firestoreService = inject(FirestoreService);
  private authService = inject(AuthService);

  channelForm: FormGroup;
  nameErrorMessage: string = '';

  constructor(private fb: FormBuilder,
    ) {
    this.channelForm = this.fb.group({
      name: [
        '',
        [
          Validators.required,
          Validators.minLength(3),
          Validators.maxLength(20),
        ],
      ],
      description: [''],
    });

    this.loadData();

  }

  async loadData() {
    this.activUserId = await this.authService.getActiveUserId();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isVisible'] && changes['isVisible'].currentValue === true) {
      requestAnimationFrame(() => {
        if (this.nameInput) {
          this.nameInput.nativeElement.focus();
        }
      });
    }
  }

  closeModal(event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    
    this.close.emit();
    
    this.channelForm.reset();
    this.nameErrorMessage = '';
  }

  createChannel(): void {
    if (this.channelForm.valid) {
      this.channelCreated.emit(this.channelForm.value);
      this.firestoreService.createChannelFirestore(this.channelForm.value, this.activUserId);
      this.channelForm.reset();
      this.close.emit();
    } else {
      this.markFormGroupTouched(this.channelForm);
    }
  }
  markFormGroupTouched(formGroup: FormGroup) {
    Object.values(formGroup.controls).forEach((control) => {
      control.markAsTouched();
      control.markAsDirty();
    });
  }

  shouldShowError(controlName: string): boolean {
    const control = this.channelForm.get(controlName);
    return control
      ? control.invalid && (control.dirty || control.touched)
      : false;
  }

  getCharCount(controlName: string): number {
    const control = this.channelForm.get(controlName);
    return control ? control.value?.length || 0 : 0;
  }

  isNearCharLimit(controlName: string): boolean {
    if (controlName === 'name') {
      const currentLength = this.getCharCount(controlName);
      return currentLength >= 16 && currentLength < 20; 
    }
    return false;
  }

  isAtCharLimit(controlName: string): boolean {
    if (controlName === 'name') {
      return this.getCharCount(controlName) >= 20;
    }
    return false;
  }
}
