import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';

@Component({
  selector: 'app-delete-channel-messages-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-container">
      <div class="modal-content">
        <div class="warning-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </div>
        <h2>Nachrichten löschen</h2>
        <p>Möchten Sie wirklich alle Nachrichten aus diesem Channel löschen? Diese Aktion kann nicht rückgängig gemacht werden.</p>
        <div class="button-group">
          <button class="cancel-btn" (click)="close(false)">Abbrechen</button>
          <button class="confirm-btn" (click)="close(true)">Löschen bestätigen</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-container {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }

    .modal-content {
      background: white;
      border-radius: 12px;
      padding: 24px;
      max-width: 400px;
      width: 90%;
      text-align: center;
      animation: modal-pop 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    @keyframes modal-pop {
      from {
        opacity: 0;
        transform: scale(0.95);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    .warning-icon {
      color: #dc3545;
      margin-bottom: 16px;
      
      svg {
        width: 48px;
        height: 48px;
      }
    }

    h2 {
      font-size: 20px;
      margin: 0 0 12px;
      color: #2c3e50;
    }

    p {
      color: #666;
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .button-group {
      display: flex;
      gap: 12px;
      justify-content: center;
    }

    button {
      padding: 10px 20px;
      border-radius: 8px;
      border: none;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .cancel-btn {
      background: #e9ecef;
      color: #495057;

      &:hover {
        background: #dee2e6;
      }
    }

    .confirm-btn {
      background: #dc3545;
      color: white;
      
      &:hover {
        background: #c82333;
        transform: translateY(-1px);
      }

      &:active {
        transform: translateY(1px);
      }
    }
  `]
})
export class DeleteChannelMessagesModalComponent {
  constructor(
    public dialogRef: DialogRef<boolean>,
    @Inject(DIALOG_DATA) public data: { channelName: string }
  ) {}

  close(result: boolean) {
    this.dialogRef.close(result);
  }
} 