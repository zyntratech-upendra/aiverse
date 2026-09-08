import { 
  fetchUsers, 
  fetchUser, 
  createUser, 
  bulkCreateUsers, 
  updateUser as apiUpdateUser, 
  deleteUser as apiDeleteUser, 
  deleteParticipantCascade as apiDeleteParticipantCascade 
} from "./apiClient";

export interface SupabaseUser {
  id: string;
  auth_id?: string | null;
  name: string;
  display_name?: string | null;
  email: string;
  personal_email?: string | null;
  phone?: string | null;
  role: string;
  status: "Active" | "Pending" | "Deactivated" | string;
  position?: string | null;
  bio?: string | null;
  linkedin?: string | null;
  github?: string | null;
  image?: string | null;
  show_in_about?: boolean;
  year?: string | null;
  team_name?: string | null;
  event_title?: string | null;
  registration_id?: string | null;
  created_at?: string | number;
  updated_at?: string | number;
}

export type CreateUserData = Omit<SupabaseUser, "id" | "created_at" | "updated_at"> & { id?: string };

export const userService = {
  /**
   * Fetch all users from MongoDB
   */
  async getUsers(query?: { role?: string; email?: string }): Promise<SupabaseUser[]> {
    try {
      const backendUsers: any = await fetchUsers(query);
      return (backendUsers || []).map((u: any) => ({
        id: u.id || u._id || u.uid || "",
        auth_id: u.auth_id || u.uid || null,
        name: u.name || u.displayName || u.display_name || "",
        display_name: u.display_name || u.displayName || u.name || null,
        email: u.email || "",
        personal_email: u.personal_email || u.personalEmail || null,
        phone: u.phone || u.phoneNumber || null,
        role: u.role || "Guest",
        status: u.status || "Active",
        position: u.position || u.displayRole || null,
        bio: u.bio || null,
        linkedin: u.linkedin || null,
        github: u.github || null,
        image: u.image || null,
        show_in_about: Boolean(u.show_in_about),
        year: u.year || null,
        team_name: u.team_name || u.teamName || null,
        event_title: u.event_title || u.eventTitle || null,
        registration_id: u.registration_id || u.registrationId || null,
        created_at: u.created_at || u.createdAt || null,
        updated_at: u.updated_at || u.updatedAt || null,
      })) as SupabaseUser[];
    } catch (err) {
      console.error("[userService] Error fetching users from MongoDB:", err);
      return [];
    }
  },

  /**
   * Fetch a single user by ID or Email
   */
  async getUserById(id: string): Promise<SupabaseUser | null> {
    if (!id) return null;
    try {
      const u: any = await fetchUser(id);
      if (!u) return null;
      return {
        id: u.id || u._id || u.uid || "",
        auth_id: u.auth_id || u.uid || null,
        name: u.name || u.displayName || u.display_name || "",
        display_name: u.display_name || u.displayName || u.name || null,
        email: u.email || "",
        personal_email: u.personal_email || u.personalEmail || null,
        phone: u.phone || u.phoneNumber || null,
        role: u.role || "Guest",
        status: u.status || "Active",
        position: u.position || u.displayRole || null,
        bio: u.bio || null,
        linkedin: u.linkedin || null,
        github: u.github || null,
        image: u.image || null,
        show_in_about: Boolean(u.show_in_about),
        year: u.year || null,
        team_name: u.team_name || u.teamName || null,
        event_title: u.event_title || u.eventTitle || null,
        registration_id: u.registration_id || u.registrationId || null,
        created_at: u.created_at || u.createdAt || null,
        updated_at: u.updated_at || u.updatedAt || null,
      };
    } catch {
      return null;
    }
  },

  async getUserByEmail(email: string): Promise<SupabaseUser | null> {
    const cleanEmail = (email || "").toLowerCase().trim();
    if (!cleanEmail) return null;
    return await this.getUserById(cleanEmail);
  },

  /**
   * Add a new user record in MongoDB
   */
  async addUser(user: CreateUserData): Promise<SupabaseUser> {
    const cleanEmail = user.email.toLowerCase().trim();
    const payload = {
      ...user,
      email: cleanEmail,
      display_name: user.display_name || user.name,
      status: user.status || "Active",
      updated_at: Date.now(),
      created_at: Date.now(),
    };

    const res: any = await createUser(payload);
    const saved = res.user || res;
    return {
      id: saved.id || saved._id || saved.uid || cleanEmail,
      name: saved.name || user.name,
      email: cleanEmail,
      role: saved.role || user.role || "participant",
      status: saved.status || "Active",
      ...saved,
    };
  },

  /**
   * Bulk upsert of user profiles in MongoDB
   */
  async bulkUpsertUsers(users: CreateUserData[]): Promise<void> {
    if (!users || users.length === 0) return;
    const rawPayloads = users
      .filter((u) => u && u.email)
      .map((user) => ({
        ...user,
        email: user.email.toLowerCase().trim(),
        display_name: user.display_name || user.name,
        status: user.status || "Active",
      }));

    if (rawPayloads.length > 0) {
      await bulkCreateUsers(rawPayloads);
    }
  },

  /**
   * Bulk create auth users (MongoDB accounts)
   */
  async bulkCreateAuthUsers(
    authAccounts: Array<{
      email: string;
      password?: string;
      name?: string;
      phone?: string;
      role?: string;
      registrationId?: string;
      eventTitle?: string;
      isQuiz?: boolean;
    }>
  ): Promise<{ created: number; updated: number; failed: number }> {
    if (!authAccounts || authAccounts.length === 0) {
      return { created: 0, updated: 0, failed: 0 };
    }

    const uniqueAccounts = Array.from(
      new Map(
        authAccounts
          .filter((a) => a && a.email && a.email.includes("@"))
          .map((a) => [a.email.toLowerCase().trim(), { ...a, email: a.email.toLowerCase().trim() }])
      ).values()
    );

    try {
      const usersToInsert = uniqueAccounts.map((acc) => ({
        email: acc.email,
        password: acc.password || "Password123!",
        name: acc.name || acc.email.split("@")[0],
        phone: acc.phone || "",
        role: acc.role || "participant",
        registration_id: acc.registrationId || "",
        event_title: acc.eventTitle || "",
        status: "Active",
      }));

      const res: any = await bulkCreateUsers(usersToInsert);
      return {
        created: res.upsertedCount || usersToInsert.length,
        updated: res.modifiedCount || 0,
        failed: 0,
      };
    } catch (err) {
      console.error("[userService] bulkCreateAuthUsers error:", err);
      return { created: 0, updated: 0, failed: uniqueAccounts.length };
    }
  },

  /**
   * Update an existing user in MongoDB
   */
  async updateUser(id: string, updates: Partial<CreateUserData>): Promise<SupabaseUser | null> {
    try {
      const cleanEmail = updates.email ? updates.email.toLowerCase().trim() : undefined;
      const payload: Record<string, any> = {
        ...updates,
        updated_at: Date.now(),
      };
      if (cleanEmail) payload.email = cleanEmail;

      const res: any = await apiUpdateUser(id, payload);
      const updated = res?.user || res;
      return updated ? { ...updated, id: updated.id || updated._id || id } : null;
    } catch (err) {
      console.error("[userService] Error updating user:", err);
      return null;
    }
  },

  /**
   * Delete a user permanently from MongoDB
   */
  async deleteUser(id: string): Promise<void> {
    if (!id) return;
    try {
      await apiDeleteUser(id);
    } catch (err) {
      console.error("[userService] Error deleting user:", err);
    }
  },

  /**
   * Delete a user by email permanently from MongoDB
   */
  async deleteUserByEmail(email: string): Promise<void> {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail) return;
    try {
      await apiDeleteUser(cleanEmail);
    } catch (err) {
      console.error("[userService] Error deleting user by email:", err);
    }
  },

  /**
   * Bulk insert users into MongoDB
   */
  async bulkAddUsers(usersList: CreateUserData[]): Promise<SupabaseUser[]> {
    await this.bulkUpsertUsers(usersList);
    return await this.getUsers();
  },

  /**
   * Fetch team members specifically for the About page
   */
  async getAboutTeamMembers(): Promise<SupabaseUser[]> {
    try {
      const users = await this.getUsers();
      return users.filter((u) => u.show_in_about && u.status === "Active");
    } catch (err) {
      console.error("[userService] Error fetching about team members:", err);
      return [];
    }
  },

  /**
   * Complete cascade deletion of a participant / team registration across MongoDB
   */
  async deleteParticipantCascade(reg: {
    id: string;
    eventId?: string;
    teamSize?: number;
    teamEmail?: string;
    teamLeadEmail?: string;
    teamLeadPersonalEmail?: string;
    teamLeadCollegeEmail?: string;
    groupName?: string;
    members?: Array<{ email?: string }>;
  }): Promise<{ success: boolean; supabaseResult?: any }> {
    const emailsToPurge = new Set<string>();

    if (reg.teamEmail) emailsToPurge.add(reg.teamEmail.toLowerCase().trim());
    if (reg.teamLeadEmail) emailsToPurge.add(reg.teamLeadEmail.toLowerCase().trim());
    if (reg.teamLeadPersonalEmail) emailsToPurge.add(reg.teamLeadPersonalEmail.toLowerCase().trim());
    if (reg.teamLeadCollegeEmail) emailsToPurge.add(reg.teamLeadCollegeEmail.toLowerCase().trim());

    if (Array.isArray(reg.members)) {
      reg.members.forEach((m) => {
        if (m.email) emailsToPurge.add(m.email.toLowerCase().trim());
      });
    }

    if (reg.groupName && reg.groupName !== "Individual RSVP") {
      const cleanGroup = reg.groupName.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanGroup) {
        emailsToPurge.add(`${cleanGroup}@aiverse.in`);
      }
    }

    const emailList = Array.from(emailsToPurge).filter(Boolean);

    try {
      await apiDeleteParticipantCascade(reg.id, emailList, Number(reg.teamSize) || 1, reg.eventId);
      return { success: true };
    } catch (apiErr) {
      console.error("[userService] Error calling backend cascade delete:", apiErr);
      return { success: false };
    }
  },
};
