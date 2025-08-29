export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          wallet_address: string
          username: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          wallet_address: string
          username?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          wallet_address?: string
          username?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      game_history: {
        Row: {
          id: string
          user_id: string
          game_code: string
          game_type: string
          buy_in_amount: string
          result: 'won' | 'lost' | 'active'
          winnings: string | null
          created_at: string
          block_number: number | null
          transaction_hash: string | null
        }
        Insert: {
          id?: string
          user_id: string
          game_code: string
          game_type: string
          buy_in_amount: string
          result?: 'won' | 'lost' | 'active'
          winnings?: string | null
          created_at?: string
          block_number?: number | null
          transaction_hash?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          game_code?: string
          game_type?: string
          buy_in_amount?: string
          result?: 'won' | 'lost' | 'active'
          winnings?: string | null
          created_at?: string
          block_number?: number | null
          transaction_hash?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_history_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      game_lists: {
        Row: {
          id: string
          user_id: string
          name: string
          description: string | null
          game_codes: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          description?: string | null
          game_codes?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          description?: string | null
          game_codes?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_lists_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}