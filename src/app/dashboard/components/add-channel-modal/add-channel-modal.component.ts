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
        style({ opacity: 0 }),
        animate('300ms ease-out', style({ opacity: 1 })),
      ]),
      transition(':leave', [animate('200ms ease-in', style({ opacity: 0 }))]),
    ]),
    trigger('scaleInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-30px) scale(0.95)' }),
        animate(
          '400ms cubic-bezier(0.175, 0.885, 0.32, 1.275)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateY(30px) scale(0.95)' })
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
      setTimeout(() => {
        if (this.nameInput) {
          this.nameInput.nativeElement.focus();
        }
      }, 100);
    }
  }

  closeModal(event: MouseEvent): void {
    event.preventDefault();
    this.channelForm.reset();
    this.close.emit();
  }

  createChannel(): void {
    if (this.channelForm.valid) {
      this.channelCreated.emit(this.channelForm.value);
      this.firestoreService.createChannelFirestore(this.channelForm.value, this.activUserId);
      // this.firestoreService.readChannelFirestore();
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
