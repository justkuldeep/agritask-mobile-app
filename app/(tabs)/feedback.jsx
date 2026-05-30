/**
 * Feedback tab entry point
 * 
 * Renders the main feedback screen directly within the tab
 * to avoid navigation redirect issues with the Tabs navigator.
 * The feedback content is in the parallel /feedback/index.jsx file
 * which is reused here to prevent the "attempted to navigate before
 * mounting the Root Layout" error.
 */
import FeedbackScreen from '../feedback/index';

export default FeedbackScreen;
