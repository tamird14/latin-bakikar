import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable item component
const SortableQueueItem = ({ 
  song, 
  index, 
  isHost, 
  formatDuration,
  isDragging 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: song.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-gray-800 rounded-lg p-4 transition-all duration-200 ${
        isSortableDragging
          ? 'shadow-2xl rotate-2 bg-gray-700 z-50'
          : 'hover:bg-gray-750'
      }`}
    >
      <div className="flex items-center space-x-4">
        {/* Drag Handle */}
        {isHost && (
          <div
            {...attributes}
            {...listeners}
            className="text-gray-500 hover:text-gray-300 cursor-grab active:cursor-grabbing touch-none"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path>
            </svg>
          </div>
        )}

        {/* Position Number */}
        <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-gray-300">
          {index + 1}
        </div>

        {/* Song Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-white truncate">
            {song.name}
          </p>
          <p className="text-sm text-gray-400 truncate">
            {song.artists?.join(', ') || 'Unknown Artist'}
          </p>
        </div>

        {/* Duration */}
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-400">
            {formatDuration(song.duration)}
          </span>
        </div>
      </div>

      {/* Mobile Duration */}
      <div className="sm:hidden mt-2 text-xs text-gray-500">
        Duration: {formatDuration(song.duration)}
      </div>
    </div>
  );
};

const Queue = ({ queue, currentSong, isHost, onReorder }) => {
  const [activeId, setActiveId] = useState(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id && isHost) {
      const oldIndex = queue.findIndex(item => item.id === active.id);
      const newIndex = queue.findIndex(item => item.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newQueue = arrayMove(queue, oldIndex, newIndex);
        onReorder(newQueue);
      }
    }

    setActiveId(null);
  };

  const formatDuration = (duration) => {
    if (!duration) return '--:--';
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (queue.length === 0 && !currentSong) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-400">
        <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <span className="text-3xl">📝</span>
        </div>
        <p className="text-lg mb-2">Queue is empty</p>
        <p className="text-sm text-center mb-4">
          Browse and add songs to start listening together
        </p>
        <p className="text-xs text-gray-500 text-center">
          💡 Songs can only be played from the <strong>Player</strong> tab
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Currently Playing */}
      {currentSong && (
        <div className="bg-gray-800 rounded-lg p-4 mb-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-purple-400 font-medium mb-1">Now Playing</p>
              <p className="font-semibold text-white truncate">{currentSong.name}</p>
              <p className="text-sm text-gray-400 truncate">
                {currentSong.artists?.join(', ') || 'Unknown Artist'}
              </p>
            </div>
            <div className="flex items-center space-x-2 ml-4">
              <span className="text-sm text-gray-400">
                {formatDuration(currentSong.duration)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Queue Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white">
          Up Next ({queue.length})
        </h2>
        {isHost && queue.length > 0 && (
          <p className="text-sm text-gray-400">
            Drag to reorder
          </p>
        )}
      </div>

      {/* Queue List or Empty State */}
      {queue.length > 0 ? (
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={queue.map(song => song.id)}
            strategy={verticalListSortingStrategy}
            disabled={!isHost}
          >
            <div className="space-y-2">
              {queue.map((song, index) => (
                <SortableQueueItem
                  key={song.id}
                  song={song}
                  index={index}
                  isHost={isHost}
                  formatDuration={formatDuration}
                  isDragging={activeId === song.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="text-center py-8 text-gray-400">
          <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl">📝</span>
          </div>
          <p className="text-lg mb-2">No songs queued</p>
          <p className="text-sm">Add songs to continue listening</p>
        </div>
      )}

      {/* Usage Info */}
      {queue.length > 0 && (
        <div className="mt-6 p-3 bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-400 text-center mb-2">
            💡 <strong>How to play songs:</strong>
          </p>
          <p className="text-sm text-gray-400 text-center">
            Go to the <strong>Player</strong> tab and click Play to start the first song in the queue
          </p>
          {!isHost && (
            <p className="text-sm text-gray-500 text-center mt-2">
              Only the host can reorder the queue and control playback
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Queue; 