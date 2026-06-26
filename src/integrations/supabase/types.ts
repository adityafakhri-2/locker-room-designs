export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      addresses: {
        Row: {
          alamat: string;
          created_at: string;
          id: string;
          is_default: boolean;
          kode_pos: string;
          kota: string;
          label: string | null;
          no_hp: string;
          provinsi: string;
          recipient_name: string;
          user_id: string;
        };
        Insert: {
          alamat: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kode_pos: string;
          kota: string;
          label?: string | null;
          no_hp: string;
          provinsi: string;
          recipient_name: string;
          user_id: string;
        };
        Update: {
          alamat?: string;
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kode_pos?: string;
          kota?: string;
          label?: string | null;
          no_hp?: string;
          provinsi?: string;
          recipient_name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      auctions: {
        Row: {
          created_at: string;
          current_bid: number | null;
          ends_at: string;
          id: string;
          is_active: boolean;
          product_id: string | null;
          starting_price: number;
        };
        Insert: {
          created_at?: string;
          current_bid?: number | null;
          ends_at: string;
          id?: string;
          is_active?: boolean;
          product_id?: string | null;
          starting_price: number;
        };
        Update: {
          created_at?: string;
          current_bid?: number | null;
          ends_at?: string;
          id?: string;
          is_active?: boolean;
          product_id?: string | null;
          starting_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "auctions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          quantity: number;
          size: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          quantity?: number;
          size?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          quantity?: number;
          size?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          slug: string;
          sort_order: number;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          slug: string;
          sort_order?: number;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          slug?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      featured_collection_products: {
        Row: {
          collection_id: string;
          product_id: string;
          sort_order: number;
        };
        Insert: {
          collection_id: string;
          product_id: string;
          sort_order?: number;
        };
        Update: {
          collection_id?: string;
          product_id?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "featured_collection_products_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "featured_collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "featured_collection_products_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      featured_collections: {
        Row: {
          cover_url: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          slug: string;
          sort_order: number;
          subtitle: string | null;
          title: string;
        };
        Insert: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          slug: string;
          sort_order?: number;
          subtitle?: string | null;
          title: string;
        };
        Update: {
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          slug?: string;
          sort_order?: number;
          subtitle?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      loyalty_points: {
        Row: {
          points: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          points?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          points?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          created_at: string;
          id: string;
          image_url: string | null;
          order_id: string;
          product_id: string | null;
          product_name: string;
          product_slug: string | null;
          quantity: number;
          size: string | null;
          subtotal: number;
          unit_price: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          order_id: string;
          product_id?: string | null;
          product_name: string;
          product_slug?: string | null;
          quantity: number;
          size?: string | null;
          subtotal: number;
          unit_price: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          image_url?: string | null;
          order_id?: string;
          product_id?: string | null;
          product_name?: string;
          product_slug?: string | null;
          quantity?: number;
          size?: string | null;
          subtotal?: number;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          cancel_reason: string | null;
          courier: string | null;
          created_at: string;
          grand_total: number;
          id: string;
          note: string | null;
          order_number: string;
          recipient_alamat: string;
          recipient_kode_pos: string;
          recipient_kota: string;
          recipient_name: string;
          recipient_no_hp: string;
          recipient_provinsi: string;
          shipping_cost: number;
          status: Database["public"]["Enums"]["order_status"];
          subtotal: number;
          timeline: Json;
          tracking_number: string | null;
          updated_at: string;
          user_id: string;
          voucher_id: string | null;
          voucher_code: string | null;
          discount_amount: number;
        };
        Insert: {
          cancel_reason?: string | null;
          courier?: string | null;
          created_at?: string;
          grand_total?: number;
          id?: string;
          note?: string | null;
          order_number?: string;
          recipient_alamat: string;
          recipient_kode_pos: string;
          recipient_kota: string;
          recipient_name: string;
          recipient_no_hp: string;
          recipient_provinsi: string;
          shipping_cost?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          timeline?: Json;
          tracking_number?: string | null;
          updated_at?: string;
          user_id: string;
          voucher_id?: string | null;
          voucher_code?: string | null;
          discount_amount?: number;
        };
        Update: {
          cancel_reason?: string | null;
          courier?: string | null;
          created_at?: string;
          grand_total?: number;
          id?: string;
          note?: string | null;
          order_number?: string;
          recipient_alamat?: string;
          recipient_kode_pos?: string;
          recipient_kota?: string;
          recipient_name?: string;
          recipient_no_hp?: string;
          recipient_provinsi?: string;
          shipping_cost?: number;
          status?: Database["public"]["Enums"]["order_status"];
          subtotal?: number;
          timeline?: Json;
          tracking_number?: string | null;
          updated_at?: string;
          user_id?: string;
          voucher_id?: string | null;
          voucher_code?: string | null;
          discount_amount?: number;
        };
        Relationships: [];
      };
      payment_methods: {
        Row: {
          code: string;
          id: string;
          is_active: boolean;
          name: string;
        };
        Insert: {
          code: string;
          id?: string;
          is_active?: boolean;
          name: string;
        };
        Update: {
          code?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
        };
        Relationships: [];
      };
      payment_proofs: {
        Row: {
          id: string;
          image_url: string;
          payment_id: string;
          uploaded_at: string;
        };
        Insert: {
          id?: string;
          image_url: string;
          payment_id: string;
          uploaded_at?: string;
        };
        Update: {
          id?: string;
          image_url?: string;
          payment_id?: string;
          uploaded_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_proofs_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          amount: number;
          bank: string | null;
          created_at: string;
          id: string;
          method: string;
          order_id: string;
          reject_reason: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        Insert: {
          amount: number;
          bank?: string | null;
          created_at?: string;
          id?: string;
          method?: string;
          order_id: string;
          reject_reason?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          amount?: number;
          bank?: string | null;
          created_at?: string;
          id?: string;
          method?: string;
          order_id?: string;
          reject_reason?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      product_certificates: {
        Row: {
          certificate_number: string;
          created_at: string;
          id: string;
          notes: string | null;
          product_id: string;
          proof_image_url: string | null;
        };
        Insert: {
          certificate_number: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          product_id: string;
          proof_image_url?: string | null;
        };
        Update: {
          certificate_number?: string;
          created_at?: string;
          id?: string;
          notes?: string | null;
          product_id?: string;
          proof_image_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_certificates_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt: string | null;
          created_at: string;
          id: string;
          product_id: string;
          sort_order: number;
          url: string;
        };
        Insert: {
          alt?: string | null;
          created_at?: string;
          id?: string;
          product_id: string;
          sort_order?: number;
          url: string;
        };
        Update: {
          alt?: string | null;
          created_at?: string;
          id?: string;
          product_id?: string;
          sort_order?: number;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          authenticity_badge: Database["public"]["Enums"]["authenticity_badge"] | null;
          brand: string | null;
          category_id: string | null;
          category_ids: string[];
          collector_score: number;
          condition: string | null;
          country: string | null;
          cover_image_url: string | null;
          created_at: string;
          description: string | null;
          id: string;
          is_active: boolean;
          is_best_seller: boolean;
          league: string | null;
          name: string;
          price: number;
          release_year: number | null;
          sizes: string[];
          slug: string;
          sold_count: number;
          size_stock: Json;
          stock: number;
          story: string | null;
          team: string | null;
          updated_at: string;
          video_url: string | null;
        };
        Insert: {
          authenticity_badge?: Database["public"]["Enums"]["authenticity_badge"] | null;
          brand?: string | null;
          category_id?: string | null;
          category_ids?: string[];
          collector_score?: number;
          condition?: string | null;
          country?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_best_seller?: boolean;
          league?: string | null;
          name: string;
          price?: number;
          release_year?: number | null;
          sizes?: string[];
          slug: string;
          sold_count?: number;
          size_stock?: Json;
          stock?: number;
          story?: string | null;
          team?: string | null;
          updated_at?: string;
          video_url?: string | null;
        };
        Update: {
          authenticity_badge?: Database["public"]["Enums"]["authenticity_badge"] | null;
          brand?: string | null;
          category_id?: string | null;
          category_ids?: string[];
          collector_score?: number;
          condition?: string | null;
          country?: string | null;
          cover_image_url?: string | null;
          created_at?: string;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_best_seller?: boolean;
          league?: string | null;
          name?: string;
          price?: number;
          release_year?: number | null;
          sizes?: string[];
          slug?: string;
          sold_count?: number;
          size_stock?: Json;
          stock?: number;
          story?: string | null;
          team?: string | null;
          updated_at?: string;
          video_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_conditions: {
        Row: {
          created_at: string;
          id: string;
          name: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          alamat: string | null;
          created_at: string;
          email: string | null;
          id: string;
          kode_pos: string | null;
          kota: string | null;
          nama_lengkap: string | null;
          no_hp: string | null;
          provinsi: string | null;
          updated_at: string;
        };
        Insert: {
          alamat?: string | null;
          created_at?: string;
          email?: string | null;
          id: string;
          kode_pos?: string | null;
          kota?: string | null;
          nama_lengkap?: string | null;
          no_hp?: string | null;
          provinsi?: string | null;
          updated_at?: string;
        };
        Update: {
          alamat?: string | null;
          created_at?: string;
          email?: string | null;
          id?: string;
          kode_pos?: string | null;
          kota?: string | null;
          nama_lengkap?: string | null;
          no_hp?: string | null;
          provinsi?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          referee_id: string | null;
          referrer_id: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          referee_id?: string | null;
          referrer_id: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          referee_id?: string | null;
          referrer_id?: string;
        };
        Relationships: [];
      };
      reviews: {
        Row: {
          approved: boolean;
          body: string | null;
          created_at: string;
          hidden: boolean;
          id: string;
          order_id: string | null;
          photos: string[];
          product_id: string;
          rating: number;
          user_id: string;
        };
        Insert: {
          approved?: boolean;
          body?: string | null;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          order_id?: string | null;
          photos?: string[];
          product_id: string;
          rating: number;
          user_id: string;
        };
        Update: {
          approved?: boolean;
          body?: string | null;
          created_at?: string;
          hidden?: boolean;
          id?: string;
          order_id?: string | null;
          photos?: string[];
          product_id?: string;
          rating?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      shipments: {
        Row: {
          courier: string | null;
          id: string;
          order_id: string;
          status: string;
          tracking_number: string | null;
          updated_at: string;
        };
        Insert: {
          courier?: string | null;
          id?: string;
          order_id: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Update: {
          courier?: string | null;
          id?: string;
          order_id?: string;
          status?: string;
          tracking_number?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shipments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      wishlists: {
        Row: {
          created_at: string;
          id: string;
          product_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          product_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          product_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      vouchers: {
        Row: {
          id: string;
          code: string;
          discount_type: string;
          discount_value: number;
          min_purchase: number;
          max_discount: number | null;
          start_date: string;
          end_date: string | null;
          usage_limit: number | null;
          usage_count: number;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_type: string;
          discount_value: number;
          min_purchase?: number;
          max_discount?: number | null;
          start_date?: string;
          end_date?: string | null;
          usage_limit?: number | null;
          usage_count?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          discount_type?: string;
          discount_value?: number;
          min_purchase?: number;
          max_discount?: number | null;
          start_date?: string;
          end_date?: string | null;
          usage_limit?: number | null;
          usage_count?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      next_order_number: { Args: never; Returns: string };
      has_registered_users: { Args: never; Returns: boolean };
      check_and_cancel_expired_orders: { Args: never; Returns: unknown };
      cancel_own_order: {
        Args: {
          target_order_id: string;
        };
        Returns: unknown;
      };
      confirm_delivery_own_order: {
        Args: {
          target_order_id: string;
        };
        Returns: unknown;
      };
    };
    Enums: {
      app_role: "admin" | "customer";
      authenticity_badge: "original_verified" | "match_worn" | "collector_item" | "limited_edition";
      condition_rating: "mint" | "excellent" | "good" | "fair";
      order_status: "pending" | "paid" | "processing" | "shipped" | "delivered" | "cancelled";
      payment_status: "waiting_payment" | "waiting_verification" | "approved" | "rejected";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "customer"],
      authenticity_badge: ["original_verified", "match_worn", "collector_item", "limited_edition"],
      condition_rating: ["mint", "excellent", "good", "fair"],
      order_status: ["pending", "paid", "processing", "shipped", "delivered", "cancelled"],
      payment_status: ["waiting_payment", "waiting_verification", "approved", "rejected"],
    },
  },
} as const;
