// SERVICIO PARA MENU SEMANAL - GOOGLE DRIVE INTEGRATION

import { processMenuText } from './menuProcessor.js';

export class DriveService {
  constructor() {
    // MENU-SEMANAL: La app toma los datos de este archivo.
    // Ellos solo modifican este Doc/archivo y la app muestra el menú actualizado.
    // Google Docs (export txt): https://docs.google.com/document/d/ID/edit → /export?format=txt
    this.DOC_URL = "https://docs.google.com/document/d/1I0rImxiunxeQWVqs0ZTsx3fftwdt0rF9ZJnLPyN9rfE/export?format=txt";
    // Backup local si Drive falla
    this.LOCAL_URL = "/menu-semanal.txt";
  }

  // Leer archivo de texto desde Google Drive
  async readMenuFromDrive() {
    try {
      console.log('📁 Leyendo menú desde Google Drive...');
      console.log('URL:', this.DOC_URL);
      
      // Intentar leer directamente desde Google Drive (ahora es público)
      const response = await fetch(this.DOC_URL);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const textContent = await response.text();
      console.log('✅ Texto leído exitosamente desde Google Drive');
      console.log('📄 Longitud del texto:', textContent.length);
      console.log('🔍 Primeros 100 caracteres:', textContent.substring(0, 100));
      
      return textContent;
      
    } catch (error) {
      console.error('❌ Error leyendo desde Drive:', error);
      
      // Backup local como fallback
      console.log('📄 Usando backup local...');
      try {
        const localResponse = await fetch(this.LOCAL_URL);
        if (localResponse.ok) {
          const textContent = await localResponse.text();
          console.log('✅ Texto leído desde backup local');
          return textContent;
        }
      } catch (localError) {
        console.error('❌ Error con backup local:', localError);
      }
      
      return null;
    }
  }

  // Procesar menú y devolver estructura para la app
  async processAndSaveMenu() {
    try {
      console.log('🔄 Iniciando procesamiento del menú desde Drive...');
      
      // 1. Leer texto crudo desde Drive
      const rawMenuText = await this.readMenuFromDrive();
      
      if (!rawMenuText) {
        throw new Error('No se pudo leer el menú desde Drive');
      }

      console.log('📄 Texto crudo leído:', rawMenuText.substring(0, 100) + '...');

      // 2. Procesar texto a estructura JSON
      const processedMenu = processMenuText(rawMenuText);
      
      console.log('✅ Menú procesado exitosamente desde Drive');
      console.log('📊 Días procesados:', processedMenu.length);

      return processedMenu;
    } catch (error) {
      console.error('❌ Error procesando menú desde Drive:', error);
      throw error;
    }
  }

  // Verificar si hay actualizaciones
  async checkForUpdates() {
    try {
      const lastCheck = localStorage.getItem('lastMenuCheck') || 0;
      const now = Date.now();
      
      // Verificar cada 5 minutos
      if (now - lastCheck > 5 * 60 * 1000) {
        localStorage.setItem('lastMenuCheck', now.toString());
        return true; // Hay que verificar
      }
      
      return false;
    } catch (error) {
      console.error('Error verificando actualizaciones:', error);
      return false;
    }
  }

  // Método alternativo con Google Sheets (opcional)
  async readMenuFromSheets() {
    try {
      // Para Google Sheets: https://docs.google.com/spreadsheets/d/ID/export?format=csv
      console.log('📊 Leyendo desde Google Sheets...');
      
      const sheetsUrl = "https://docs.google.com/spreadsheets/d/TU_SHEETS_ID/export?format=csv";
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(sheetsUrl)}`;
      
      const response = await fetch(proxyUrl);
      const csvContent = await response.text();
      
      // Convertir CSV al formato esperado
      return this.convertCsvToMenuFormat(csvContent);
    } catch (error) {
      console.error('Error leyendo desde Sheets:', error);
      return null;
    }
  }

  // Convertir CSV a formato de menú
  convertCsvToMenuFormat(csvContent) {
    // Implementación para convertir CSV de Sheets a texto
    // Esto es opcional, por ahora usamos Docs
    return csvContent;
  }
}

// Opción para GitHub (backup)
export class GitHubService {
  constructor() {
    this.REPO_OWNER = 'TU_USERNAME';
    this.REPO_NAME = 'menu-semanal';
    this.FILE_PATH = 'menu-semanal.txt';
    this.RAW_URL = `https://raw.githubusercontent.com/${this.REPO_OWNER}/${this.REPO_NAME}/main/${this.FILE_PATH}`;
  }

  async readMenuFromGitHub() {
    try {
      console.log('📚 Leyendo menú desde GitHub...');
      
      const response = await fetch(this.RAW_URL);
      
      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.status}`);
      }
      
      const textContent = await response.text();
      console.log('✅ Texto leído exitosamente desde GitHub');
      
      return textContent;
    } catch (error) {
      console.error('❌ Error leyendo desde GitHub:', error);
      return null;
    }
  }

  async processAndSaveMenu() {
    try {
      console.log('🔄 Iniciando procesamiento desde GitHub...');
      
      const rawMenuText = await this.readMenuFromGitHub();
      
      if (!rawMenuText) {
        throw new Error('No se pudo leer el menú desde GitHub');
      }

      const processedMenu = processMenuText(rawMenuText);
      
      console.log('✅ Menú procesado exitosamente desde GitHub');
      return processedMenu;
    } catch (error) {
      console.error('❌ Error procesando menú desde GitHub:', error);
      throw error;
    }
  }

  async checkForUpdates() {
    try {
      const lastCheck = localStorage.getItem('lastMenuCheck') || 0;
      const now = Date.now();
      
      if (now - lastCheck > 5 * 60 * 1000) {
        localStorage.setItem('lastMenuCheck', now.toString());
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error verificando actualizaciones:', error);
      return false;
    }
  }
}
