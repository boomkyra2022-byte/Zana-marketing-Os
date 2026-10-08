import { createClient } from '@/lib/supabase/server';
import { AIChatClient } from '@/components/ai-chat-client';
export default async function AIChatPage() {
  const db=createClient();const {data:{user}}=await db.auth.getUser();
  const {data:profile}=user?await db.from('profiles').select('role,status').eq('id',user.id).single():{data:null};
  if(!profile||profile.status!=='approved'||!['owner','admin','content_lead'].includes(profile.role))return <div className="card p-6"><h1 className="text-xl font-bold">AI Chat</h1><p>ข้อมูลลูกค้าเข้าถึงได้เฉพาะ Owner, Admin และ Content Lead ที่ได้รับอนุมัติ</p></div>;
  return <AIChatClient />;
}
