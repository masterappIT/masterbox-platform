import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { assignConversation, loadRoomAssignees } from '../redux/slices/messagesSlices';
import { selectUserInfo } from '../redux/slices/userSlices';

/**
 * Who handles the conversation and who it can go to, for the customer panel.
 * assign(agentId | null) resolves when saved and rejects with the reason it wasn't.
 */
export default function useRoomAssignment(room) {
  const dispatch = useDispatch();
  const userInfo = useSelector(selectUserInfo);
  const [assignees, setAssignees] = useState([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const roomId = room?.id || null;
  // Read again when the conversation's agent changes, in case someone left the channel meanwhile.
  const assigneeId = room?.assignee?.id || null;

  useEffect(() => {
    if (!roomId) return undefined;
    let active = true;
    setLoadFailed(false);
    dispatch(loadRoomAssignees({ id: roomId })).unwrap()
      .then((agents) => { if (active) setAssignees(agents); })
      .catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [roomId, assigneeId]);

  const assign = (agentId) => dispatch(assignConversation({ id: roomId, assigneeId: agentId || null })).unwrap()
    .catch((reason) => { throw new Error(reason?.message || String(reason || '')); });

  return {
    assignees,
    loadFailed,
    assign,
    myId: userInfo?._id || null,
    isAdmin: String(userInfo?.role || '').toLowerCase() === 'admin',
  };
}
