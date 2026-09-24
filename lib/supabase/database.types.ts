export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accessi_clienti: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "accessi_clienti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessi_clienti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accessi_clienti_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profili"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_mensili: {
        Row: {
          categoria_id: string
          created_at: string
          created_by: string | null
          id: string
          importo: number
          mese: string
          updated_at: string
        }
        Insert: {
          categoria_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          importo: number
          mese: string
          updated_at?: string
        }
        Update: {
          categoria_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          importo?: number
          mese?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_mensili_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorie"
            referencedColumns: ["id"]
          },
        ]
      }
      categorie: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito_categoria"]
          archiviata: boolean
          budget_default: number | null
          colore: string | null
          created_at: string
          created_by: string | null
          icona: string | null
          id: string
          nome: string
          ordine: number
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          ambito?: Database["public"]["Enums"]["ambito_categoria"]
          archiviata?: boolean
          budget_default?: number | null
          colore?: string | null
          created_at?: string
          created_by?: string | null
          icona?: string | null
          id?: string
          nome: string
          ordine?: number
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          ambito?: Database["public"]["Enums"]["ambito_categoria"]
          archiviata?: boolean
          budget_default?: number | null
          colore?: string | null
          created_at?: string
          created_by?: string | null
          icona?: string | null
          id?: string
          nome?: string
          ordine?: number
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorie_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categorie"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti: {
        Row: {
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          codice_sdi: string | null
          colore: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          indirizzo: string | null
          logo_path: string | null
          nazione: string
          nome_breve: string | null
          note: string | null
          pec: string | null
          piva: string | null
          provincia: string | null
          ragione_sociale: string
          sito: string | null
          stato: Database["public"]["Enums"]["stato_cliente"]
          tags: string[]
          telefono: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"]
          updated_at: string
        }
        Insert: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          codice_sdi?: string | null
          colore?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          logo_path?: string | null
          nazione?: string
          nome_breve?: string | null
          note?: string | null
          pec?: string | null
          piva?: string | null
          provincia?: string | null
          ragione_sociale: string
          sito?: string | null
          stato?: Database["public"]["Enums"]["stato_cliente"]
          tags?: string[]
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Update: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          codice_sdi?: string | null
          colore?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          indirizzo?: string | null
          logo_path?: string | null
          nazione?: string
          nome_breve?: string | null
          note?: string | null
          pec?: string | null
          piva?: string | null
          provincia?: string | null
          ragione_sociale?: string
          sito?: string | null
          stato?: Database["public"]["Enums"]["stato_cliente"]
          tags?: string[]
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"]
          updated_at?: string
        }
        Relationships: []
      }
      clienti_contatti: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          nome: string
          principale: boolean
          ruolo: string | null
          telefono: string | null
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome: string
          principale?: boolean
          ruolo?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          nome?: string
          principale?: boolean
          ruolo?: string | null
          telefono?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clienti_contatti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_contatti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti_diario: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          data: string
          id: string
          testo: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          testo: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          testo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clienti_diario_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_diario_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      clienti_link: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          etichetta: string
          id: string
          ordine: number
          updated_at: string
          url: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          etichetta: string
          id?: string
          ordine?: number
          updated_at?: string
          url: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          etichetta?: string
          id?: string
          ordine?: number
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "clienti_link_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clienti_link_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      credenziali: {
        Row: {
          cliente_id: string | null
          created_at: string
          created_by: string | null
          etichetta: string
          id: string
          iv: string | null
          payload_cifrato: string | null
          salt: string | null
          servizio_id: string | null
          tipo: Database["public"]["Enums"]["tipo_credenziale"]
          updated_at: string
          url_password_manager: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          etichetta: string
          id?: string
          iv?: string | null
          payload_cifrato?: string | null
          salt?: string | null
          servizio_id?: string | null
          tipo: Database["public"]["Enums"]["tipo_credenziale"]
          updated_at?: string
          url_password_manager?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          etichetta?: string
          id?: string
          iv?: string | null
          payload_cifrato?: string | null
          salt?: string | null
          servizio_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_credenziale"]
          updated_at?: string
          url_password_manager?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credenziali_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credenziali_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credenziali_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credenziali_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "v_servizi"
            referencedColumns: ["id"]
          },
        ]
      }
      debiti: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"]
          created_at: string
          created_by: string | null
          creditore: string
          data_inizio: string | null
          descrizione: string | null
          id: string
          importo_totale: number
          note: string | null
          tipo: Database["public"]["Enums"]["tipo_debito"]
          updated_at: string
        }
        Insert: {
          ambito?: Database["public"]["Enums"]["ambito"]
          created_at?: string
          created_by?: string | null
          creditore: string
          data_inizio?: string | null
          descrizione?: string | null
          id?: string
          importo_totale: number
          note?: string | null
          tipo: Database["public"]["Enums"]["tipo_debito"]
          updated_at?: string
        }
        Update: {
          ambito?: Database["public"]["Enums"]["ambito"]
          created_at?: string
          created_by?: string | null
          creditore?: string
          data_inizio?: string | null
          descrizione?: string | null
          id?: string
          importo_totale?: number
          note?: string | null
          tipo?: Database["public"]["Enums"]["tipo_debito"]
          updated_at?: string
        }
        Relationships: []
      }
      debiti_rate: {
        Row: {
          created_at: string
          created_by: string | null
          debito_id: string
          id: string
          importo: number
          movimento_id: string | null
          numero: number
          pagata: boolean
          scadenza: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          debito_id: string
          id?: string
          importo: number
          movimento_id?: string | null
          numero: number
          pagata?: boolean
          scadenza: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          debito_id?: string
          id?: string
          importo?: number
          movimento_id?: string | null
          numero?: number
          pagata?: boolean
          scadenza?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "debiti_rate_debito_id_fkey"
            columns: ["debito_id"]
            isOneToOne: false
            referencedRelation: "debiti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debiti_rate_movimento_fk"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimenti"
            referencedColumns: ["id"]
          },
        ]
      }
      eventi: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"]
          cliente_id: string | null
          created_at: string
          created_by: string | null
          fine: string | null
          id: string
          inizio: string
          link_call: string | null
          luogo: string | null
          note: string | null
          progetto_id: string | null
          ricorrenza: string | null
          titolo: string
          tutto_il_giorno: boolean
          updated_at: string
        }
        Insert: {
          ambito?: Database["public"]["Enums"]["ambito"]
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          fine?: string | null
          id?: string
          inizio: string
          link_call?: string | null
          luogo?: string | null
          note?: string | null
          progetto_id?: string | null
          ricorrenza?: string | null
          titolo: string
          tutto_il_giorno?: boolean
          updated_at?: string
        }
        Update: {
          ambito?: Database["public"]["Enums"]["ambito"]
          cliente_id?: string | null
          created_at?: string
          created_by?: string | null
          fine?: string | null
          id?: string
          inizio?: string
          link_call?: string | null
          luogo?: string | null
          note?: string | null
          progetto_id?: string | null
          ricorrenza?: string | null
          titolo?: string
          tutto_il_giorno?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "eventi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventi_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eventi_progetto_id_fkey"
            columns: ["progetto_id"]
            isOneToOne: false
            referencedRelation: "progetti"
            referencedColumns: ["id"]
          },
        ]
      }
      movimenti: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"]
          categoria_id: string | null
          created_at: string
          created_by: string | null
          data: string
          descrizione: string | null
          id: string
          importo: number
          metodo_pagamento: string | null
          periodo: string | null
          rata_id: string | null
          ricevuta_path: string | null
          servizio_id: string | null
          stato: Database["public"]["Enums"]["stato_movimento"]
          updated_at: string
        }
        Insert: {
          ambito?: Database["public"]["Enums"]["ambito"]
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descrizione?: string | null
          id?: string
          importo: number
          metodo_pagamento?: string | null
          periodo?: string | null
          rata_id?: string | null
          ricevuta_path?: string | null
          servizio_id?: string | null
          stato?: Database["public"]["Enums"]["stato_movimento"]
          updated_at?: string
        }
        Update: {
          ambito?: Database["public"]["Enums"]["ambito"]
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          descrizione?: string | null
          id?: string
          importo?: number
          metodo_pagamento?: string | null
          periodo?: string | null
          rata_id?: string | null
          ricevuta_path?: string | null
          servizio_id?: string | null
          stato?: Database["public"]["Enums"]["stato_movimento"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "movimenti_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_rata_id_fkey"
            columns: ["rata_id"]
            isOneToOne: true
            referencedRelation: "debiti_rate"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimenti_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "v_servizi"
            referencedColumns: ["id"]
          },
        ]
      }
      permessi: {
        Row: {
          created_at: string
          created_by: string | null
          livello: Database["public"]["Enums"]["livello_permesso"]
          sezione: Database["public"]["Enums"]["sezione_permesso"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          livello: Database["public"]["Enums"]["livello_permesso"]
          sezione: Database["public"]["Enums"]["sezione_permesso"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          livello?: Database["public"]["Enums"]["livello_permesso"]
          sezione?: Database["public"]["Enums"]["sezione_permesso"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "permessi_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profili"
            referencedColumns: ["id"]
          },
        ]
      }
      profili: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          nome: string | null
          ruolo: Database["public"]["Enums"]["ruolo_utente"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id: string
          nome?: string | null
          ruolo?: Database["public"]["Enums"]["ruolo_utente"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string | null
          ruolo?: Database["public"]["Enums"]["ruolo_utente"]
          updated_at?: string
        }
        Relationships: []
      }
      progetti: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"]
          cliente_id: string | null
          colore: string | null
          created_at: string
          created_by: string | null
          descrizione: string | null
          id: string
          nome: string
          scadenza: string | null
          stato: Database["public"]["Enums"]["stato_progetto"]
          updated_at: string
        }
        Insert: {
          ambito?: Database["public"]["Enums"]["ambito"]
          cliente_id?: string | null
          colore?: string | null
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          id?: string
          nome: string
          scadenza?: string | null
          stato?: Database["public"]["Enums"]["stato_progetto"]
          updated_at?: string
        }
        Update: {
          ambito?: Database["public"]["Enums"]["ambito"]
          cliente_id?: string | null
          colore?: string | null
          created_at?: string
          created_by?: string | null
          descrizione?: string | null
          id?: string
          nome?: string
          scadenza?: string | null
          stato?: Database["public"]["Enums"]["stato_progetto"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "progetti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progetti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
        ]
      }
      servizi: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"]
          chi_paga: Database["public"]["Enums"]["chi_paga"]
          created_at: string
          created_by: string | null
          fornitore: string | null
          frequenza: Database["public"]["Enums"]["frequenza_servizio"]
          id: string
          nome: string
          note: string | null
          preavviso_giorni: number | null
          prossima_scadenza: string
          rinnovo_automatico: boolean
          stato: Database["public"]["Enums"]["stato_servizio"]
          tipo_id: string | null
          updated_at: string
          url_pannello: string | null
          username: string | null
        }
        Insert: {
          ambito?: Database["public"]["Enums"]["ambito"]
          chi_paga?: Database["public"]["Enums"]["chi_paga"]
          created_at?: string
          created_by?: string | null
          fornitore?: string | null
          frequenza?: Database["public"]["Enums"]["frequenza_servizio"]
          id?: string
          nome: string
          note?: string | null
          preavviso_giorni?: number | null
          prossima_scadenza: string
          rinnovo_automatico?: boolean
          stato?: Database["public"]["Enums"]["stato_servizio"]
          tipo_id?: string | null
          updated_at?: string
          url_pannello?: string | null
          username?: string | null
        }
        Update: {
          ambito?: Database["public"]["Enums"]["ambito"]
          chi_paga?: Database["public"]["Enums"]["chi_paga"]
          created_at?: string
          created_by?: string | null
          fornitore?: string | null
          frequenza?: Database["public"]["Enums"]["frequenza_servizio"]
          id?: string
          nome?: string
          note?: string | null
          preavviso_giorni?: number | null
          prossima_scadenza?: string
          rinnovo_automatico?: boolean
          stato?: Database["public"]["Enums"]["stato_servizio"]
          tipo_id?: string | null
          updated_at?: string
          url_pannello?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servizi_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipi_servizio"
            referencedColumns: ["id"]
          },
        ]
      }
      servizi_clienti: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          note: string | null
          servizio_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          note?: string | null
          servizio_id: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          note?: string | null
          servizio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servizi_clienti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_clienti_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_clienti_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_clienti_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "v_servizi"
            referencedColumns: ["id"]
          },
        ]
      }
      servizi_clienti_economico: {
        Row: {
          cliente_id: string
          created_at: string
          created_by: string | null
          prezzo_rivendita: number | null
          servizio_id: string
          updated_at: string
        }
        Insert: {
          cliente_id: string
          created_at?: string
          created_by?: string | null
          prezzo_rivendita?: number | null
          servizio_id: string
          updated_at?: string
        }
        Update: {
          cliente_id?: string
          created_at?: string
          created_by?: string | null
          prezzo_rivendita?: number | null
          servizio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servizi_clienti_economico_servizio_id_cliente_id_fkey"
            columns: ["servizio_id", "cliente_id"]
            isOneToOne: true
            referencedRelation: "servizi_clienti"
            referencedColumns: ["servizio_id", "cliente_id"]
          },
        ]
      }
      servizi_economico: {
        Row: {
          categoria_spesa_id: string | null
          costo: number | null
          created_at: string
          created_by: string | null
          metodo_pagamento: string | null
          servizio_id: string
          updated_at: string
          valuta: string
        }
        Insert: {
          categoria_spesa_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          metodo_pagamento?: string | null
          servizio_id: string
          updated_at?: string
          valuta?: string
        }
        Update: {
          categoria_spesa_id?: string | null
          costo?: number | null
          created_at?: string
          created_by?: string | null
          metodo_pagamento?: string | null
          servizio_id?: string
          updated_at?: string
          valuta?: string
        }
        Relationships: [
          {
            foreignKeyName: "servizi_economico_categoria_fk"
            columns: ["categoria_spesa_id"]
            isOneToOne: false
            referencedRelation: "categorie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_economico_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: true
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_economico_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: true
            referencedRelation: "v_servizi"
            referencedColumns: ["id"]
          },
        ]
      }
      servizi_rinnovi: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          id: string
          importo: number | null
          movimento_id: string | null
          servizio_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          id?: string
          importo?: number | null
          movimento_id?: string | null
          servizio_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          id?: string
          importo?: number | null
          movimento_id?: string | null
          servizio_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "servizi_rinnovi_movimento_fk"
            columns: ["movimento_id"]
            isOneToOne: false
            referencedRelation: "movimenti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_rinnovi_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_rinnovi_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "v_servizi"
            referencedColumns: ["id"]
          },
        ]
      }
      task: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"]
          assegnata_a: string | null
          cliente_id: string | null
          completata_il: string | null
          created_at: string
          created_by: string | null
          data_pianificata: string | null
          durata_min: number | null
          id: string
          in_attesa_dal: string | null
          in_attesa_di: string | null
          note: string | null
          ordine: number
          parent_id: string | null
          priorita: number | null
          progetto_id: string | null
          ricorrenza: string | null
          scadenza: string | null
          servizio_id: string | null
          stato: Database["public"]["Enums"]["stato_task"]
          titolo: string
          updated_at: string
        }
        Insert: {
          ambito?: Database["public"]["Enums"]["ambito"]
          assegnata_a?: string | null
          cliente_id?: string | null
          completata_il?: string | null
          created_at?: string
          created_by?: string | null
          data_pianificata?: string | null
          durata_min?: number | null
          id?: string
          in_attesa_dal?: string | null
          in_attesa_di?: string | null
          note?: string | null
          ordine?: number
          parent_id?: string | null
          priorita?: number | null
          progetto_id?: string | null
          ricorrenza?: string | null
          scadenza?: string | null
          servizio_id?: string | null
          stato?: Database["public"]["Enums"]["stato_task"]
          titolo: string
          updated_at?: string
        }
        Update: {
          ambito?: Database["public"]["Enums"]["ambito"]
          assegnata_a?: string | null
          cliente_id?: string | null
          completata_il?: string | null
          created_at?: string
          created_by?: string | null
          data_pianificata?: string | null
          durata_min?: number | null
          id?: string
          in_attesa_dal?: string | null
          in_attesa_di?: string | null
          note?: string | null
          ordine?: number
          parent_id?: string | null
          priorita?: number | null
          progetto_id?: string | null
          ricorrenza?: string | null
          scadenza?: string | null
          servizio_id?: string | null
          stato?: Database["public"]["Enums"]["stato_task"]
          titolo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_assegnata_a_fkey"
            columns: ["assegnata_a"]
            isOneToOne: false
            referencedRelation: "profili"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "v_clienti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_progetto_id_fkey"
            columns: ["progetto_id"]
            isOneToOne: false
            referencedRelation: "progetti"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "servizi"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_servizio_id_fkey"
            columns: ["servizio_id"]
            isOneToOne: false
            referencedRelation: "v_servizi"
            referencedColumns: ["id"]
          },
        ]
      }
      tipi_servizio: {
        Row: {
          created_at: string
          created_by: string | null
          icona: string | null
          id: string
          nome: string
          preavviso_default: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          icona?: string | null
          id?: string
          nome: string
          preavviso_default?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          icona?: string | null
          id?: string
          nome?: string
          preavviso_default?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_calendario: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"] | null
          cliente_id: string | null
          fine: string | null
          id: string | null
          inizio: string | null
          modificabile: boolean | null
          ricorrenza: string | null
          tipo: string | null
          titolo: string | null
          tutto_il_giorno: boolean | null
        }
        Relationships: []
      }
      v_clienti: {
        Row: {
          cap: string | null
          citta: string | null
          codice_fiscale: string | null
          codice_sdi: string | null
          colore: string | null
          created_at: string | null
          created_by: string | null
          email: string | null
          id: string | null
          indirizzo: string | null
          logo_path: string | null
          nazione: string | null
          nome_breve: string | null
          note: string | null
          pec: string | null
          piva: string | null
          provincia: string | null
          ragione_sociale: string | null
          servizi_attivi: number | null
          sito: string | null
          stato: Database["public"]["Enums"]["stato_cliente"] | null
          tags: string[] | null
          task_aperte: number | null
          telefono: string | null
          tipo: Database["public"]["Enums"]["tipo_cliente"] | null
          updated_at: string | null
        }
        Insert: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          codice_sdi?: string | null
          colore?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string | null
          indirizzo?: string | null
          logo_path?: string | null
          nazione?: string | null
          nome_breve?: string | null
          note?: string | null
          pec?: string | null
          piva?: string | null
          provincia?: string | null
          ragione_sociale?: string | null
          servizi_attivi?: never
          sito?: string | null
          stato?: Database["public"]["Enums"]["stato_cliente"] | null
          tags?: string[] | null
          task_aperte?: never
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
          updated_at?: string | null
        }
        Update: {
          cap?: string | null
          citta?: string | null
          codice_fiscale?: string | null
          codice_sdi?: string | null
          colore?: string | null
          created_at?: string | null
          created_by?: string | null
          email?: string | null
          id?: string | null
          indirizzo?: string | null
          logo_path?: string | null
          nazione?: string | null
          nome_breve?: string | null
          note?: string | null
          pec?: string | null
          piva?: string | null
          provincia?: string | null
          ragione_sociale?: string | null
          servizi_attivi?: never
          sito?: string | null
          stato?: Database["public"]["Enums"]["stato_cliente"] | null
          tags?: string[] | null
          task_aperte?: never
          telefono?: string | null
          tipo?: Database["public"]["Enums"]["tipo_cliente"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      v_servizi: {
        Row: {
          ambito: Database["public"]["Enums"]["ambito"] | null
          categoria_spesa_id: string | null
          chi_paga: Database["public"]["Enums"]["chi_paga"] | null
          costo: number | null
          created_at: string | null
          created_by: string | null
          fornitore: string | null
          frequenza: Database["public"]["Enums"]["frequenza_servizio"] | null
          giorni_alla_scadenza: number | null
          id: string | null
          metodo_pagamento: string | null
          nome: string | null
          note: string | null
          preavviso_effettivo: number | null
          preavviso_giorni: number | null
          prossima_scadenza: string | null
          rinnovo_automatico: boolean | null
          stato: Database["public"]["Enums"]["stato_servizio"] | null
          stato_scadenza: string | null
          tipo_icona: string | null
          tipo_id: string | null
          tipo_nome: string | null
          updated_at: string | null
          url_pannello: string | null
          username: string | null
          valuta: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servizi_economico_categoria_fk"
            columns: ["categoria_spesa_id"]
            isOneToOne: false
            referencedRelation: "categorie"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "servizi_tipo_id_fkey"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipi_servizio"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      imposta_contatto_principale: {
        Args: { p_contatto_id: string }
        Returns: undefined
      }
      is_owner: { Args: never; Returns: boolean }
      oggi: { Args: never; Returns: string }
      puo: {
        Args: {
          p_livello?: Database["public"]["Enums"]["livello_permesso"]
          p_sezione: Database["public"]["Enums"]["sezione_permesso"]
        }
        Returns: boolean
      }
      storage_accesso: {
        Args: {
          p_bucket: string
          p_livello: Database["public"]["Enums"]["livello_permesso"]
          p_nome: string
        }
        Returns: boolean
      }
      try_uuid: { Args: { valore: string }; Returns: string }
      vede_cliente: { Args: { p_cliente_id: string }; Returns: boolean }
      vede_credenziale: {
        Args: {
          p_cliente_id: string
          p_livello: Database["public"]["Enums"]["livello_permesso"]
          p_servizio_id: string
        }
        Returns: boolean
      }
      vede_servizio: { Args: { p_servizio_id: string }; Returns: boolean }
      vede_task: {
        Args: {
          p_ambito: Database["public"]["Enums"]["ambito"]
          p_assegnata_a: string
          p_cliente_id: string
          p_livello: Database["public"]["Enums"]["livello_permesso"]
        }
        Returns: boolean
      }
    }
    Enums: {
      ambito: "lavoro" | "personale"
      ambito_categoria: "lavoro" | "personale" | "entrambi"
      chi_paga: "io" | "cliente"
      frequenza_servizio:
        | "mensile"
        | "trimestrale"
        | "semestrale"
        | "annuale"
        | "biennale"
        | "una_tantum"
      livello_permesso: "lettura" | "scrittura"
      ruolo_utente: "owner" | "collaboratore"
      sezione_permesso:
        | "clienti"
        | "servizi"
        | "credenziali"
        | "calendario"
        | "task"
        | "budget"
      stato_cliente: "attivo" | "potenziale" | "in_pausa" | "archiviato"
      stato_movimento: "previsto" | "pagato"
      stato_progetto: "attivo" | "in_pausa" | "completato" | "archiviato"
      stato_servizio: "attivo" | "disdetto" | "archiviato"
      stato_task: "da_fare" | "in_corso" | "in_attesa" | "fatto"
      tipo_cliente: "azienda" | "privato"
      tipo_credenziale: "link_password_manager" | "cifrata"
      tipo_debito: "rateale" | "unica_soluzione" | "prestito_privato"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ambito: ["lavoro", "personale"],
      ambito_categoria: ["lavoro", "personale", "entrambi"],
      chi_paga: ["io", "cliente"],
      frequenza_servizio: [
        "mensile",
        "trimestrale",
        "semestrale",
        "annuale",
        "biennale",
        "una_tantum",
      ],
      livello_permesso: ["lettura", "scrittura"],
      ruolo_utente: ["owner", "collaboratore"],
      sezione_permesso: [
        "clienti",
        "servizi",
        "credenziali",
        "calendario",
        "task",
        "budget",
      ],
      stato_cliente: ["attivo", "potenziale", "in_pausa", "archiviato"],
      stato_movimento: ["previsto", "pagato"],
      stato_progetto: ["attivo", "in_pausa", "completato", "archiviato"],
      stato_servizio: ["attivo", "disdetto", "archiviato"],
      stato_task: ["da_fare", "in_corso", "in_attesa", "fatto"],
      tipo_cliente: ["azienda", "privato"],
      tipo_credenziale: ["link_password_manager", "cifrata"],
      tipo_debito: ["rateale", "unica_soluzione", "prestito_privato"],
    },
  },
} as const
