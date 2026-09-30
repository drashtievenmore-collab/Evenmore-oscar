// Sample sales-team directory used ONLY when the real team roster is empty
// (backend has no users yet / team-roster pull returned nothing). As soon as
// the server provides members, those replace this list everywhere it is used
// via withSampleTeam().
export const SAMPLE_TEAM_MEMBERS = [
  { id: 'sample-emp-1', name: 'Rahul Sharma', email: 'rahul.sharma@example.com', designation: 'Sales Manager', status: 'Active' },
  { id: 'sample-emp-2', name: 'Priya Nair', email: 'priya.nair@example.com', designation: 'Sales Executive', status: 'Active' },
  { id: 'sample-emp-3', name: 'Amit Verma', email: 'amit.verma@example.com', designation: 'Sales Executive', status: 'Active' },
  { id: 'sample-emp-4', name: 'Sneha Rao', email: 'sneha.rao@example.com', designation: 'Telecaller', status: 'Active' },
  { id: 'sample-emp-5', name: 'Vikram Mehta', email: 'vikram.mehta@example.com', designation: 'Business Development', status: 'Active' },
];

/** Real roster when it has anyone, otherwise the sample directory. */
export function withSampleTeam(members) {
  return members && members.length > 0 ? members : SAMPLE_TEAM_MEMBERS;
}
